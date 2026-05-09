/**
 * create-company — Supabase Edge Function
 *
 * Creates a new company + admin user for multi-tenant onboarding.
 * Called when a new company signs up for TradeFlow TimeClock.
 *
 * POST body:
 * {
 *   company_name: string,
 *   company_slug: string,        // URL-friendly name (e.g. "acme-plumbing")
 *   admin_email: string,
 *   admin_password: string,
 *   admin_first_name: string,
 *   admin_last_name: string,
 *   contact_phone?: string,
 *   primary_color?: string,
 *   secondary_color?: string,
 * }
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const {
      company_name,
      company_slug,
      admin_email,
      admin_password,
      admin_first_name,
      admin_last_name,
      contact_phone,
      primary_color,
      secondary_color,
    } = await req.json();

    // Validate required fields
    if (!company_name || !company_slug || !admin_email || !admin_password || !admin_first_name || !admin_last_name) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: company_name, company_slug, admin_email, admin_password, admin_first_name, admin_last_name" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use the service role key to create users and bypass RLS
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // 1. Check if slug is already taken
    const { data: existingCompany } = await supabaseAdmin
      .from("companies")
      .select("id")
      .eq("slug", company_slug)
      .maybeSingle();

    if (existingCompany) {
      return new Response(
        JSON.stringify({ error: "Company slug already taken. Please choose a different one." }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Create the company record
    const { data: company, error: companyError } = await supabaseAdmin
      .from("companies")
      .insert({
        name: company_name,
        slug: company_slug,
        contact_email: admin_email,
        contact_phone: contact_phone || null,
        primary_color: primary_color || "#0b3ea8",
        secondary_color: secondary_color || "#fc6b04",
        subscription_tier: "basic",
        subscription_status: "trial",
        trial_ends_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(), // 14 day trial
      })
      .select()
      .single();

    if (companyError) {
      return new Response(
        JSON.stringify({ error: `Failed to create company: ${companyError.message}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Create the admin auth user
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: admin_email,
      password: admin_password,
      email_confirm: true,
    });

    if (authError) {
      // Clean up the company we just created
      await supabaseAdmin.from("companies").delete().eq("id", company.id);
      return new Response(
        JSON.stringify({ error: `Failed to create admin user: ${authError.message}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 4. Create the employee record (admin role) linked to the company
    const { error: empError } = await supabaseAdmin.from("employees").insert({
      user_id: authUser.user.id,
      email: admin_email,
      first_name: admin_first_name,
      last_name: admin_last_name,
      phone: contact_phone || null,
      role: "admin",
      company_id: company.id,
      is_active: true,
    });

    if (empError) {
      console.log("Employee creation error:", empError.message);
      // Don't fail — the auth user exists, they can be linked later
    }

    return new Response(
      JSON.stringify({
        success: true,
        company_id: company.id,
        company_slug: company.slug,
        admin_user_id: authUser.user.id,
        trial_ends_at: company.trial_ends_at,
        message: `Company "${company_name}" created! Admin can now sign in.`,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message || "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
