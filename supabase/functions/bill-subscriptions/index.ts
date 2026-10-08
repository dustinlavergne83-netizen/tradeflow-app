// bill-subscriptions/index.ts
// ─────────────────────────────────────────────────────────────────────────────
// Deployed to the TRADEFLOW Supabase project (xbwgtxbgypzkvqusotra). Bills
// BOTH trials whose trial_ends_at has passed AND active subscriptions whose
// next_billing_at has passed, using TradeFlow's own Clover merchant account
// (CLOVER_TF_PRIVATE_KEY).
//
// Pricing: flat $49/mo regardless of employee count, UNLESS
// companies.custom_monthly_cents is set (including 0 — comped, no Clover
// call is made, still recorded in subscription_charges). The old
// +$5/employee-after-5 tier was removed — flat rate for everyone now.
//
// Companies with cancel_at_period_end = true are NOT billed when their
// current period ends — instead their access is revoked (subscription_status
// -> 'expired') so the one period they already paid for is honored, but no
// further charge happens. They can still sign in and resubscribe any time
// from the Billing page.
//
// Run daily via cron. Can also be called with { companyId } for on-demand
// billing (used by SuperAdmin's "Charge Now" button).
// ─────────────────────────────────────────────────────────────────────────────
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { isSuperAdminEmail } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const CLOVER_TF_PRIVATE_KEY = Deno.env.get("CLOVER_TF_PRIVATE_KEY") ?? "";
const CLOVER_API = "https://scl.clover.com/v1";

const BASE_PRICE_CENTS = 4900;
const BILLING_PERIOD_DAYS = 30;

function calcAmountCents(customMonthlyCents: number | null): number {
  if (customMonthlyCents !== null && customMonthlyCents !== undefined) return customMonthlyCents;
  return BASE_PRICE_CENTS;
}

function formatDollars(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (!CLOVER_TF_PRIVATE_KEY) {
      throw new Error("CLOVER_TF_PRIVATE_KEY is not configured in Supabase secrets.");
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

    let singleCompanyId: string | null = null;
    try {
      const body = await req.json().catch(() => ({}));
      singleCompanyId = body?.companyId ?? null;
    } catch (_) { /* no body is fine */ }

    // This function runs daily via cron (sends the service-role key directly
    // as the Authorization header) AND can be called on-demand with a
    // companyId (used by SuperAdmin's "Charge Now" button, authenticated as
    // the signed-in super-admin's own JWT). Previously accepted a companyId
    // from ANY caller with no auth check at all — any signed-in user could
    // charge any company's card by passing a different companyId.
    const authHeader = req.headers.get("Authorization") ?? "";
    const bearerToken = authHeader.replace(/^Bearer\s+/i, "").trim();
    const isCronCall = !!SERVICE_ROLE_KEY && bearerToken === SERVICE_ROLE_KEY;

    if (singleCompanyId && !isCronCall) {
      const userClient = createClient(SUPABASE_URL, ANON_KEY, {
        global: { headers: { Authorization: authHeader } },
        auth: { persistSession: false },
      });
      const { data: callerData, error: callerErr } = await userClient.auth.getUser();
      if (callerErr || !callerData?.user || !isSuperAdminEmail(callerData.user.email)) {
        return new Response(
          JSON.stringify({ success: false, error: "Only a super admin may trigger an on-demand charge." }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    } else if (!singleCompanyId && !isCronCall) {
      // A full (no companyId) billing sweep must only ever be the cron job.
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const nowIso = new Date().toISOString();
    const selectCols = "id, name, slug, subscription_status, clover_customer_id, clover_card_id, card_last4, card_brand, custom_monthly_cents, trial_ends_at, next_billing_at, cancel_at_period_end";

    let companies: any[] = [];

    if (singleCompanyId) {
      const { data, error } = await supabase.from("companies").select(selectCols).eq("id", singleCompanyId);
      if (error) throw error;
      companies = data ?? [];
    } else {
      const { data: trialRows, error: trialErr } = await supabase
        .from("companies").select(selectCols)
        .eq("subscription_status", "trial")
        .lte("trial_ends_at", nowIso);
      if (trialErr) throw trialErr;

      const { data: activeRows, error: activeErr } = await supabase
        .from("companies").select(selectCols)
        .eq("subscription_status", "active")
        .not("next_billing_at", "is", null)
        .lte("next_billing_at", nowIso);
      if (activeErr) throw activeErr;

      companies = [...(trialRows ?? []), ...(activeRows ?? [])];
    }

    if (companies.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "Nothing due for billing.", billed: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const results: any[] = [];

    for (const company of companies) {
      const companyResult: any = { companyId: company.id, slug: company.slug, name: company.name, status: "pending" };

      try {
        // Customer cancelled — honor the period they already paid for, but
        // don't bill again. Revoke access now that the period has ended;
        // they can still sign in and resubscribe from the Billing page.
        if (company.cancel_at_period_end) {
          await supabase.from("companies").update({
            subscription_status: "expired",
            next_billing_at: null,
          }).eq("id", company.id);

          companyResult.status = "expired_cancelled";
          results.push(companyResult);
          continue;
        }

        const { count: empCount } = await supabase
          .from("employees")
          .select("*", { count: "exact", head: true })
          .eq("company_id", company.id)
          .eq("is_active", true);

        const employeeCount = empCount ?? 0;
        const amountCents = calcAmountCents(company.custom_monthly_cents ?? null);
        const periodStart = new Date();
        const periodEnd = new Date(Date.now() + BILLING_PERIOD_DAYS * 24 * 60 * 60 * 1000);

        companyResult.employeeCount = employeeCount;
        companyResult.amountCents = amountCents;
        companyResult.amount = formatDollars(amountCents);

        if (amountCents === 0) {
          await supabase.from("companies").update({
            subscription_status: "active",
            subscription_tier: company.subscription_status === "trial" ? "pro" : undefined,
            last_billed_at: periodStart.toISOString(),
            next_billing_at: periodEnd.toISOString(),
          }).eq("id", company.id);

          await supabase.from("subscription_charges").insert({
            company_id: company.id,
            amount_cents: 0,
            employee_count: employeeCount,
            status: "skipped_free",
            period_start: periodStart.toISOString(),
            period_end: periodEnd.toISOString(),
          });

          companyResult.status = "skipped_free";
          results.push(companyResult);
          continue;
        }

        if (!company.clover_customer_id) {
          const errMsg = "No payment method on file.";

          await supabase.from("companies").update({
            subscription_status: "past_due",
            last_billing_error: errMsg,
            last_billing_attempt: periodStart.toISOString(),
          }).eq("id", company.id);

          await supabase.from("subscription_charges").insert({
            company_id: company.id,
            amount_cents: amountCents,
            employee_count: employeeCount,
            status: "skipped_no_card",
            error_message: errMsg,
            period_start: periodStart.toISOString(),
            period_end: periodEnd.toISOString(),
          });

          companyResult.status = "skipped_no_card";
          results.push(companyResult);
          continue;
        }

        const description = `TradeFlow subscription — ${company.name} (${employeeCount} employees)`;

        // CONFIRMED via live testing against this Clover merchant account
        // (2026-09-20): /v1/charges has NO "customer"/"customerId" field on
        // this account — sending either causes a generic "Invalid value in
        // JSON" error. Pass the CUSTOMER id directly as `source` instead;
        // Clover resolves it to that customer's saved card automatically.
        const chargeRes = await fetch(`${CLOVER_API}/charges`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${CLOVER_TF_PRIVATE_KEY}`,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            amount: amountCents,
            currency: "usd",
            source: company.clover_customer_id,
            description,
            capture: true,
          }),
        });

        const chargeData = await chargeRes.json();

        if (!chargeRes.ok) {
          const errMsg = chargeData?.error?.message || chargeData?.message || "Charge failed";
          console.error(`Billing failed for ${company.slug}:`, errMsg);

          await supabase.from("companies").update({
            subscription_status: "past_due",
            last_billing_error: errMsg,
            last_billing_attempt: periodStart.toISOString(),
          }).eq("id", company.id);

          await supabase.from("subscription_charges").insert({
            company_id: company.id,
            amount_cents: amountCents,
            employee_count: employeeCount,
            status: "failed",
            error_message: errMsg,
            period_start: periodStart.toISOString(),
            period_end: periodEnd.toISOString(),
          });

          companyResult.status = "failed";
          companyResult.error = errMsg;
          results.push(companyResult);
          continue;
        }

        const chargeId = chargeData.id ?? "";

        await supabase.from("companies").update({
          subscription_status: "active",
          subscription_tier: company.subscription_status === "trial" ? "pro" : undefined,
          last_charged_at: periodStart.toISOString(),
          last_billed_at: periodStart.toISOString(),
          last_charge_id: chargeId,
          last_charge_amount: amountCents,
          next_billing_at: periodEnd.toISOString(),
          last_billing_error: null,
        }).eq("id", company.id);

        await supabase.from("subscription_charges").insert({
          company_id: company.id,
          amount_cents: amountCents,
          employee_count: employeeCount,
          clover_charge_id: chargeId,
          status: "success",
          period_start: periodStart.toISOString(),
          period_end: periodEnd.toISOString(),
        });

        console.log(`✅ Billed ${company.slug}: ${formatDollars(amountCents)} (${employeeCount} employees) — Clover charge ${chargeId}`);

        companyResult.status = "success";
        companyResult.chargeId = chargeId;
        results.push(companyResult);
      } catch (companyErr: any) {
        console.error(`Error billing company ${company.slug}:`, companyErr);
        companyResult.status = "error";
        companyResult.error = companyErr?.message ?? "Unknown error";
        results.push(companyResult);
      }
    }

    const successCount = results.filter((r) => r.status === "success" || r.status === "skipped_free").length;
    const failedCount = results.length - successCount;

    return new Response(
      JSON.stringify({
        success: true,
        message: `Processed ${results.length} compan${results.length === 1 ? "y" : "ies"}: ${successCount} billed, ${failedCount} failed/skipped.`,
        billed: successCount,
        failed: failedCount,
        results,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("bill-subscriptions error:", err);
    return new Response(
      JSON.stringify({ success: false, error: err?.message || "Unexpected error." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
