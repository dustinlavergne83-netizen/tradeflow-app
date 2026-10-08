// remove-company-card/index.ts
// ─────────────────────────────────────────────────────────────────────────────
// Super-admin-only: revokes a company's saved card(s) on Clover and clears
// the local card fields, so a clean new card can be added afterward.
//
// Uses Clover's documented "Revoke a payment source" endpoint:
//   DELETE /v1/customers/{customerId}/sources/{sourceId}
//
// Revokes EVERY source currently on the customer (not just the one we
// cached in clover_card_id), since a customer created before this fix may
// have accumulated multiple stale sources from repeated "Update Card"
// attempts (PUT appends rather than replaces).
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

const CLOVER_TF_PRIVATE_KEY = Deno.env.get("CLOVER_TF_PRIVATE_KEY") ?? "";
const CLOVER_API = "https://scl.clover.com/v1";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (!CLOVER_TF_PRIVATE_KEY) {
      throw new Error("CLOVER_TF_PRIVATE_KEY is not configured in Supabase secrets.");
    }

    const authHeader = req.headers.get("Authorization") ?? "";
    const { companyId } = await req.json();
    if (!companyId) throw new Error("companyId is required.");

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

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

    const revokeResults: any[] = [];

    if (company.clover_customer_id) {
      // Fetch the customer's current source list via PUT-echo (Clover's
      // ecommerce API has no GET-by-id for customers — confirmed 405).
      const putRes = await fetch(`${CLOVER_API}/customers/${company.clover_customer_id}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${CLOVER_TF_PRIVATE_KEY}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({}),
      });

      if (putRes.ok) {
        const customer = await putRes.json();
        const sourceIds: string[] = customer.sources?.data ?? [];

        for (const sourceId of sourceIds) {
          const delRes = await fetch(
            `${CLOVER_API}/customers/${company.clover_customer_id}/sources/${sourceId}`,
            {
              method: "DELETE",
              headers: {
                Authorization: `Bearer ${CLOVER_TF_PRIVATE_KEY}`,
                Accept: "application/json",
              },
            }
          );
          revokeResults.push({ sourceId, status: delRes.status, ok: delRes.ok });
        }
      } else {
        console.error(`Could not fetch sources for ${company.clover_customer_id}:`, await putRes.text());
      }
    }

    // Clear local card fields regardless of Clover revoke outcome — the
    // goal is to let the company start clean with "Add Card" even if the
    // upstream customer record was already broken/orphaned.
    const { error: updateError } = await adminClient
      .from("companies")
      .update({
        clover_customer_id: null,
        clover_card_id: null,
        card_brand: null,
        card_last4: null,
      })
      .eq("id", companyId);

    if (updateError) throw updateError;

    console.log(`Removed card for ${company.name} (${companyId}) — revoked ${revokeResults.length} source(s)`);

    return new Response(
      JSON.stringify({ success: true, revoked: revokeResults }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("remove-company-card error:", err);
    return new Response(
      JSON.stringify({ success: false, error: err?.message || "An unexpected error occurred." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
