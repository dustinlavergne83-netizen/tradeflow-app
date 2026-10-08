// save-subscription-card/index.ts
// ─────────────────────────────────────────────────────────────────────────────
// Deployed to the TRADEFLOW Supabase project (xbwgtxbgypzkvqusotra) — NOT the
// DML/DT operational project. Called from the web app's Billing page when a
// company admin adds/updates their TradeFlow subscription payment method.
//
// Uses TradeFlow's own Clover merchant account (CLOVER_TF_PRIVATE_KEY). Only
// the Clover-issued card token reaches this function — no raw card data
// touches our servers or the companies table.
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (!CLOVER_TF_PRIVATE_KEY) {
      throw new Error("TradeFlow payment system is not configured. Contact support.");
    }

    const authHeader = req.headers.get("Authorization") ?? "";
    const { companyId, cardToken, cardBrand: cardBrandHint, cardLast4: cardLast4Hint } = await req.json();

    if (!companyId) throw new Error("companyId is required.");
    if (!cardToken) throw new Error("Card token is required.");

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    // Identify the caller from their own JWT.
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });
    const { data: callerData, error: callerErr } = await userClient.auth.getUser();
    if (callerErr || !callerData?.user) {
      return new Response(JSON.stringify({ success: false, error: "You must be signed in to update billing." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Service-role client for the authorization check and the actual writes.
    const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

    // Authorized if: caller is the platform super admin (manages billing for
    // every company on behalf of tenants that have no TradeFlow login of
    // their own), OR caller is an admin/supervisor employee of THIS company.
    const callerIsSuperAdmin = isSuperAdminEmail(callerData.user.email);

    if (!callerIsSuperAdmin) {
      const { data: emp, error: empError } = await adminClient
        .from("employees")
        .select("role, company_id")
        .eq("user_id", callerData.user.id)
        .maybeSingle();

      if (empError || !emp || emp.company_id !== companyId || !["admin", "supervisor"].includes(emp.role)) {
        return new Response(
          JSON.stringify({ success: false, error: "You are not authorized to manage billing for this company." }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    const { data: company, error: coError } = await adminClient
      .from("companies")
      .select("id, name, billing_email, clover_customer_id")
      .eq("id", companyId)
      .maybeSingle();

    if (coError || !company) throw new Error("Company not found.");

    // Always create a FRESH Clover customer on every card save/replace,
    // rather than PUT-ing the existing customer. PUT with a new `source`
    // appears to ADD to sources.data rather than replace it, which left
    // stale/ambiguous card references on customers that had their card
    // updated more than once (this caused DT Specialties' charges to fail
    // even after the source-shape fix). A brand-new customer guarantees a
    // known-good, single-card state every time — same path that has been
    // verified working end-to-end (DML Electrical).
    const cloverRes = await fetch(`${CLOVER_API}/customers`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${CLOVER_TF_PRIVATE_KEY}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        source: cardToken,
        email: company.billing_email || undefined,
        name: company.name || undefined,
      }),
    });

    if (!cloverRes.ok) {
      const errText = await cloverRes.text();
      let errMsg = "Failed to save payment method. Please check your card details.";
      try {
        const errJson = JSON.parse(errText);
        const e = errJson?.error || errJson;
        // Clover wraps plain issuer declines behind a generic "Token
        // verification failed" outer message — the useful signal is in
        // type/code/decline_code. Map the common ones to a friendly,
        // actionable message; fall back to Clover's own message otherwise.
        if (e?.type === "card_error" && e?.code === "card_declined") {
          errMsg = "Your card was declined by the issuing bank. Please contact your bank or try a different card.";
        } else if (e?.message) {
          errMsg = e.message;
        }
      } catch (_) { /* ignore */ }
      // Full raw response (type/code/param/decline_code/doc_url) is always
      // available here for support/debugging via the function logs.
      console.error("Clover customer create/update error:", errText);
      throw new Error(errMsg);
    }

    const cloverCustomer = await cloverRes.json();
    const cloverCustomerId: string = cloverCustomer.id ?? "";

    // IMPORTANT: Clover's ecommerce customer response represents
    // sources.data as an ARRAY OF CARD-ID STRINGS (e.g. "Z7Y7423XX4PS8"),
    // NOT an array of card objects with .brand/.last4 fields — confirmed
    // by direct inspection of a live customer response. Clover never
    // exposes brand/last4 on the customer object at all, so those must
    // come from the browser's tokenization result (cardBrandHint/
    // cardLast4Hint) instead.
    // Use the LAST entry in sources.data, not the first — if Clover
    // appends rather than replaces on update (PUT), the most recently
    // added card is always the correct one to charge. Safe either way
    // since a first-time card save only ever has one entry.
    const sourcesList: string[] = cloverCustomer.sources?.data ?? [];
    const cloverCardId: string | null = sourcesList[sourcesList.length - 1] ?? null;

    // NOTE: cloverCardId is stored only as informational metadata — it is
    // NOT required to charge this customer. Confirmed via live testing
    // that charging uses `source: <clover_customer_id>` directly; Clover
    // resolves the customer's saved card automatically. Only the customer
    // id itself is required, so we fail loudly on that but not on the
    // card id list being empty.
    if (!cloverCustomerId) {
      console.error("Clover customer create/update returned no id:", JSON.stringify(cloverCustomer));
      throw new Error("Card was tokenized but Clover did not return a usable customer reference. Please try again or contact support.");
    }

    const cardBrand: string = (typeof cardBrandHint === "string" && cardBrandHint) || "";
    const cardLast4: string = (typeof cardLast4Hint === "string" && cardLast4Hint) || "";

    const { error: updateError } = await adminClient
      .from("companies")
      .update({
        clover_customer_id: cloverCustomerId,
        clover_card_id: cloverCardId,
        card_brand: cardBrand,
        card_last4: cardLast4,
      })
      .eq("id", companyId);

    if (updateError) throw updateError;

    console.log(`Saved TradeFlow subscription card for ${company.name} (${companyId}) — ${cardBrand} ••••${cardLast4}`);

    return new Response(
      JSON.stringify({ success: true, cardBrand, cardLast4 }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("save-subscription-card error:", err);
    return new Response(
      JSON.stringify({ success: false, error: err?.message || "An unexpected error occurred." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
