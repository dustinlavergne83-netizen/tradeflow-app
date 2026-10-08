// cancel-subscription/index.ts
// ─────────────────────────────────────────────────────────────────────────────
// Deployed to the TRADEFLOW Supabase project (xbwgtxbgypzkvqusotra). Called
// from the web app's Billing page when a company admin cancels (or
// un-cancels) their TradeFlow subscription.
//
// Cancellation is END-OF-PERIOD, not immediate:
//   - Sets cancel_at_period_end = true. The company keeps full access and
//     is NOT billed again — bill-subscriptions checks this flag and, once
//     next_billing_at passes, flips subscription_status to "expired"
//     instead of charging the card again.
//   - The admin can still sign in on an expired/cancelled account (nothing
//     here touches auth) and resubscribe any time from Billing — calling
//     this same function again with { resume: true } clears the flag.
//
// POST { companyId: string, resume?: boolean }
// ─────────────────────────────────────────────────────────────────────────────
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { isSuperAdminEmail } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const { companyId, resume } = await req.json();

    if (!companyId) throw new Error("companyId is required.");

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    // Identify the caller from their own JWT — this function previously had
    // NO authorization check at all and would cancel any companyId passed
    // to it by any caller. Mirrors save-subscription-card's pattern.
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });
    const { data: callerData, error: callerErr } = await userClient.auth.getUser();
    if (callerErr || !callerData?.user) {
      return new Response(JSON.stringify({ success: false, error: "You must be signed in to manage billing." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

    const callerIsSuperAdmin = isSuperAdminEmail(callerData.user.email);
    if (!callerIsSuperAdmin) {
      const { data: emp, error: empError } = await adminClient
        .from("employees")
        .select("role, company_id")
        .eq("user_id", callerData.user.id)
        .maybeSingle();

      if (empError || !emp || emp.company_id !== companyId || emp.role !== "admin") {
        return new Response(
          JSON.stringify({ success: false, error: "Only the company admin can manage billing." }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    const { data: company, error: fetchError } = await adminClient
      .from("companies")
      .select("id, name, subscription_status, cancel_at_period_end, next_billing_at")
      .eq("id", companyId)
      .maybeSingle();

    if (fetchError || !company) {
      return new Response(
        JSON.stringify({ success: false, error: "Company not found." }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Resume: clear the cancellation flag (or reactivate an already- ──────
    // expired subscription so the next billing sweep picks it back up).
    if (resume) {
      const isExpired = company.subscription_status === "expired";
      const { error: updateError } = await adminClient
        .from("companies")
        .update({
          cancel_at_period_end: false,
          ...(isExpired
            ? { subscription_status: "active", next_billing_at: new Date().toISOString() }
            : {}),
        })
        .eq("id", companyId);

      if (updateError) throw updateError;

      return new Response(
        JSON.stringify({ success: true, message: `Subscription for ${company.name} has been resumed.` }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Cancel ────────────────────────────────────────────────────────────
    if (company.subscription_status === "expired") {
      return new Response(
        JSON.stringify({ success: false, error: "This subscription has already ended." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (company.cancel_at_period_end) {
      return new Response(
        JSON.stringify({ success: false, error: "This subscription is already set to cancel at period end." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { error: updateError } = await adminClient
      .from("companies")
      .update({ cancel_at_period_end: true })
      .eq("id", companyId);

    if (updateError) throw updateError;

    console.log(`Subscription set to cancel at period end for company ${companyId} (${company.name})`);

    return new Response(
      JSON.stringify({
        success: true,
        message: company.next_billing_at
          ? `Your subscription will end on ${new Date(company.next_billing_at).toLocaleDateString()}. You can keep using TradeFlow until then.`
          : `Your subscription for ${company.name} will not renew.`,
        accessUntil: company.next_billing_at,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err: any) {
    console.error("cancel-subscription error:", err);
    return new Response(
      JSON.stringify({ success: false, error: err?.message || "Internal server error" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
