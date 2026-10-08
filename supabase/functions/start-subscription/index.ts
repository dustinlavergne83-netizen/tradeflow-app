// start-subscription/index.ts
// ─────────────────────────────────────────────────────────────────────────────
// Deployed to the TRADEFLOW Supabase project (xbwgtxbgypzkvqusotra). Called
// from the web app's Billing page when a company admin wants to convert
// their free trial to a paid subscription BEFORE trial_ends_at arrives.
//
// This does NOT charge the card today. It locks in the customer's intent so
// the existing daily bill-subscriptions cron bills them automatically once
// their trial_ends_at passes — i.e. they keep the full free trial they were
// promised, with no early or surprise charge. Concretely: as long as
// subscription_status stays "trial" with its original trial_ends_at and a
// clover_customer_id, bill-subscriptions already does exactly the right
// thing on day 14. So "starting" a subscription from the admin's point of
// view really just confirms a card is on file and reassures them billing
// will happen on schedule — nothing to flip here except clearing any stray
// cancel_at_period_end flag they might have set and re-unset earlier.
//
// POST { companyId: string }
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
    const { companyId } = await req.json();

    if (!companyId) throw new Error("companyId is required.");

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    // Identify the caller from their own JWT — mirrors cancel-subscription's
    // pattern so only the company's own admin (or a super admin) can act.
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
      .select("id, name, subscription_status, clover_customer_id, trial_ends_at, cancel_at_period_end")
      .eq("id", companyId)
      .maybeSingle();

    if (fetchError || !company) {
      return new Response(
        JSON.stringify({ success: false, error: "Company not found." }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (company.subscription_status !== "trial") {
      return new Response(
        JSON.stringify({ success: false, error: "This company is not currently on a free trial." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!company.clover_customer_id) {
      return new Response(
        JSON.stringify({ success: false, error: "Add a payment method before starting your subscription." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Nothing to charge today — just make sure a prior cancellation (if any)
    // is cleared so the trial converts to a real paid subscription on
    // schedule when bill-subscriptions runs on trial_ends_at.
    if (company.cancel_at_period_end) {
      const { error: updateError } = await adminClient
        .from("companies")
        .update({ cancel_at_period_end: false })
        .eq("id", companyId);
      if (updateError) throw updateError;
    }

    console.log(`Subscription confirmed for company ${companyId} (${company.name}) — will bill on trial_ends_at (${company.trial_ends_at}).`);

    return new Response(
      JSON.stringify({
        success: true,
        message: company.trial_ends_at
          ? `You're all set! Your card will be charged automatically on ${new Date(company.trial_ends_at).toLocaleDateString()} when your free trial ends — no charge today.`
          : "You're all set! Billing will start automatically at the end of your free trial — no charge today.",
        trialEndsAt: company.trial_ends_at,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err: any) {
    console.error("start-subscription error:", err);
    return new Response(
      JSON.stringify({ success: false, error: err?.message || "Internal server error" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
