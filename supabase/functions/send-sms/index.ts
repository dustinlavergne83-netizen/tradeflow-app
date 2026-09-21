import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { to, body, customer_id, customer_name, project_id, company_id, no_signature } = await req.json();

    if (!to || !body || !company_id) {
      return new Response(JSON.stringify({ error: "Missing required fields: to, body, company_id" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get Twilio config for this company
    const { data: config, error: configError } = await supabase
      .from("twilio_config")
      .select("*")
      .eq("company_id", company_id)
      .single();

    if (configError || !config) {
      return new Response(JSON.stringify({ error: "Twilio not configured for this company" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Prefer this company's own Twilio credentials; fall back to the shared
    // platform account secrets (same pattern as twilio-outbound-call). Without
    // this fallback, companies whose twilio_config row has no account_sid/
    // auth_token (e.g. DT Specialties) send Basic auth as "null:null" and
    // every outbound text silently fails.
    const accountSid = config.account_sid || Deno.env.get("TWILIO_ACCOUNT_SID");
    const authToken  = config.auth_token  || Deno.env.get("TWILIO_AUTH_TOKEN");

    if (!accountSid || !authToken) {
      return new Response(JSON.stringify({ error: "Twilio credentials are not configured for this company" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Normalize "to" number
    const toNormalized = to.replace(/\D/g, "").replace(/^1/, "");
    const toE164 = `+1${toNormalized}`;

    // SMS has no sender-name field — the customer's phone just shows the raw
    // number unless it's already saved as a contact. To make it obvious which
    // company is texting (important now that DML and DT Specialties share this
    // function), prepend the company's business_name as a signature, unless
    // the caller already opted out (e.g. mid-thread replies) via no_signature.
    const skipSignature = !!no_signature;
    const businessName = config.business_name || "";
    const outboundBody = (businessName && !skipSignature)
      ? `${body}\n\n— ${businessName}`
      : body;

    // Send via Twilio REST API
    const twilioRes = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: "POST",
        headers: {
          "Authorization": `Basic ${btoa(`${accountSid}:${authToken}`)}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          From: config.phone_number,
          To: toE164,
          Body: outboundBody,
        }),
      }
    );

    const twilioData = await twilioRes.json();

    if (!twilioRes.ok) {
      console.error("Twilio error:", twilioData);
      return new Response(JSON.stringify({ error: twilioData.message || "Failed to send SMS" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Save to communications log
    const { data: comm, error: commError } = await supabase
      .from("communications")
      .insert({
        company_id,
        customer_id: customer_id || null,
        project_id: project_id || null,
        customer_name: customer_name || null,
        type: "sms",
        direction: "outbound",
        from_number: config.phone_number,
        to_number: toE164,
        body: outboundBody,
        status: "completed",
        twilio_sid: twilioData.sid,
      })
      .select()
      .single();

    if (commError) console.error("Failed to save communication:", commError);

    return new Response(JSON.stringify({ success: true, sid: twilioData.sid, communication: comm }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("send-sms error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
