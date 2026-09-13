import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { companyId } = await req.json();

    if (!companyId) {
      return new Response(
        JSON.stringify({ success: false, error: "companyId is required" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    // Use service role key to bypass RLS
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify the company exists
    const { data: company, error: fetchError } = await supabaseAdmin
      .from("companies")
      .select("id, name, subscription_status, clover_customer_id")
      .eq("id", companyId)
      .maybeSingle();

    if (fetchError || !company) {
      return new Response(
        JSON.stringify({ success: false, error: "Company not found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 404 }
      );
    }

    if (company.subscription_status === "canceled") {
      return new Response(
        JSON.stringify({ success: false, error: "Subscription is already canceled" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    // Update subscription status to canceled
    const { error: updateError } = await supabaseAdmin
      .from("companies")
      .update({
        subscription_status: "canceled",
        canceled_at: new Date().toISOString(),
        next_billing_at: null,
      })
      .eq("id", companyId);

    if (updateError) {
      console.error("DB update error:", updateError);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to cancel subscription" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    console.log(`Subscription canceled for company ${companyId} (${company.name})`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Subscription for ${company.name} has been canceled.`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    console.error("cancel-subscription error:", err);
    return new Response(
      JSON.stringify({ success: false, error: err.message || "Internal server error" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
