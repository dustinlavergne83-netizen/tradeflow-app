// charge-company-card/index.ts
// ─────────────────────────────────────────────────────────────────────────────
// Super-admin-only: charges an arbitrary amount to a company's card on file
// via TradeFlow's own Clover merchant account (CLOVER_TF_PRIVATE_KEY).
//
// Unlike bill-subscriptions (which bills the recurring subscription amount
// and rolls next_billing_at forward), this is a one-off manual charge — it
// does NOT touch next_billing_at or subscription_status. Used from
// SuperAdmin's "Charge $" button for ad-hoc amounts (e.g. a one-time fee).
//
// POST { companyId: string, amountCents: number, description?: string }
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

// Sanity ceiling — prevents a fat-fingered amount from charging something
// absurd. Raise this deliberately if a legitimate charge needs to exceed it.
const MAX_CHARGE_CENTS = 1_000_000; // $10,000.00

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (!CLOVER_TF_PRIVATE_KEY) {
      throw new Error("CLOVER_TF_PRIVATE_KEY is not configured in Supabase secrets.");
    }

    const authHeader = req.headers.get("Authorization") ?? "";
    const { companyId, amountCents, description } = await req.json();

    if (!companyId) throw new Error("companyId is required.");
    if (!Number.isInteger(amountCents) || amountCents <= 0) {
      throw new Error("amountCents must be a positive integer (e.g. 100 = $1.00).");
    }
    if (amountCents > MAX_CHARGE_CENTS) {
      throw new Error(`Amount exceeds the safety limit of $${(MAX_CHARGE_CENTS / 100).toFixed(2)}.`);
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    // ── Authorize: super admin only ─────────────────────────────────────────
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });
    const { data: callerData, error: callerErr } = await userClient.auth.getUser();
    if (callerErr || !callerData?.user) {
      return new Response(JSON.stringify({ success: false, error: "You must be signed in." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!isSuperAdminEmail(callerData.user.email)) {
      return new Response(JSON.stringify({ success: false, error: "Super admin only." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

    const { data: company, error: coError } = await adminClient
      .from("companies")
      .select("id, name, clover_customer_id")
      .eq("id", companyId)
      .maybeSingle();

    if (coError || !company) throw new Error("Company not found.");
    if (!company.clover_customer_id) throw new Error("This company has no payment method on file.");

    const chargeDescription = description?.trim() || `TradeFlow manual charge — ${company.name}`;

    // CONFIRMED via live testing against this Clover merchant account
    // (2026-09-20): the Clover ecommerce /v1/charges endpoint has NO
    // "customer"/"customerId" field on this account's implementation —
    // sending either causes a generic "Invalid value in JSON" error.
    // Instead, pass the CUSTOMER id as the `source` field directly; Clover
    // resolves it to that customer's saved card automatically. Passing the
    // individual card id (from customer.sources.data[]) as `source`
    // instead fails with "Customer with id ... not found".
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
        description: chargeDescription,
        capture: true,
      }),
    });

    const chargeData = await chargeRes.json();

    if (!chargeRes.ok) {
      const errMsg = chargeData?.error?.message || chargeData?.message || "Charge failed";

      await adminClient.from("subscription_charges").insert({
        company_id: company.id,
        amount_cents: amountCents,
        status: "failed",
        error_message: `[manual] ${errMsg}`,
      });

      return new Response(
        JSON.stringify({ success: false, error: errMsg }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const chargeId = chargeData.id ?? "";

    await adminClient.from("subscription_charges").insert({
      company_id: company.id,
      amount_cents: amountCents,
      clover_charge_id: chargeId,
      status: "success",
      error_message: `[manual] ${chargeDescription}`,
    });

    await adminClient.from("companies").update({
      last_charged_at: new Date().toISOString(),
      last_charge_id: chargeId,
      last_charge_amount: amountCents,
    }).eq("id", companyId);

    console.log(`Manual charge: ${company.name} — $${(amountCents / 100).toFixed(2)} — Clover charge ${chargeId}`);

    return new Response(
      JSON.stringify({ success: true, chargeId, amount: `$${(amountCents / 100).toFixed(2)}` }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("charge-company-card error:", err);
    return new Response(
      JSON.stringify({ success: false, error: err?.message || "An unexpected error occurred." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
