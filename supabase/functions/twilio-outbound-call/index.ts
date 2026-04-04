// Twilio Click-to-Call: Twilio calls YOUR cell, then connects to customer
// Customer sees your Twilio business number as caller ID
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { to_customer, company_id, customer_name, record = false } = await req.json();

    if (!to_customer || !company_id) {
      return new Response(JSON.stringify({ error: "Missing to_customer or company_id" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get Twilio config
    const { data: config } = await supabase
      .from("twilio_config")
      .select("*")
      .eq("company_id", company_id)
      .maybeSingle();

    if (!config) {
      return new Response(JSON.stringify({ error: "Twilio not configured" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const accountSid = config.account_sid;
    const authToken = config.auth_token;
    const twilioNumber = config.phone_number;
    const forwardToNumber = config.forward_to_number;

    if (!accountSid || !authToken || !twilioNumber || !forwardToNumber) {
      return new Response(JSON.stringify({ error: "Twilio config incomplete" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build the TwiML connect URL
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const connectUrl = `${supabaseUrl}/functions/v1/twilio-connect-call?to=${encodeURIComponent(to_customer)}&record=${record}&company_id=${encodeURIComponent(company_id)}`;

    // Use Twilio REST API to initiate call TO your cell (forwardToNumber)
    // When you answer, Twilio runs connectUrl TwiML to dial the customer
    const twilioBody = new URLSearchParams({
      From: twilioNumber,
      To: forwardToNumber,
      Url: connectUrl,
    });

    const twilioRes = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Calls.json`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: "Basic " + btoa(`${accountSid}:${authToken}`),
        },
        body: twilioBody.toString(),
      }
    );

    if (!twilioRes.ok) {
      const errText = await twilioRes.text();
      throw new Error(`Twilio error: ${errText}`);
    }

    const twilioData = await twilioRes.json();

    // Log call in communications table
    await supabase.from("communications").insert({
      company_id,
      type: "call",
      direction: "outbound",
      from_number: twilioNumber,
      to_number: to_customer,
      customer_name: customer_name || null,
      status: "initiated",
      recording_enabled: record,
      call_sid: twilioData.sid,
      created_at: new Date().toISOString(),
    });

    return new Response(JSON.stringify({ success: true, call_sid: twilioData.sid }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("twilio-outbound-call error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
