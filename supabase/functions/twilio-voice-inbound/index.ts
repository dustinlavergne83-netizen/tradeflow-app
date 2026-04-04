import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// This handles the INITIAL inbound call from Twilio.
// During business hours → forward to owner's cell.
// After hours → route to AI agent (twilio-ai-voice).

serve(async (req) => {
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const text = await req.text();
    const params = new URLSearchParams(text);
    const From     = params.get("From") || "";
    const To       = params.get("To") || "";
    const CallSid  = params.get("CallSid") || "";

    // Find company by Twilio number
    const { data: config } = await supabase
      .from("twilio_config")
      .select("*")
      .eq("phone_number", To)
      .single();

    if (!config) {
      return new Response(
        `<Response><Say>Thank you for calling. Goodbye.</Say></Response>`,
        { headers: { "Content-Type": "text/xml" } }
      );
    }

    // Check business hours
    const now = new Date();
    const tz = config.timezone || "America/Chicago";
    const localTime = new Intl.DateTimeFormat("en-US", {
      timeZone: tz, hour: "numeric", weekday: "short", hour12: false,
    }).formatToParts(now);
    const hour    = parseInt(localTime.find(p => p.type === "hour")?.value || "12");
    const weekday = localTime.find(p => p.type === "weekday")?.value || "Mon";
    const isBusinessDay  = (config.business_days || ["Mon","Tue","Wed","Thu","Fri"]).includes(weekday);
    const isBusinessHour = hour >= (config.business_hours_start || 7) && hour < (config.business_hours_end || 18);
    const isBusinessHours = isBusinessDay && isBusinessHour;

    // Save the call log (status will update when call ends)
    await supabase.from("communications").insert({
      company_id:  config.company_id,
      type:        isBusinessHours ? "call" : "ai_call",
      direction:   "inbound",
      from_number: From,
      to_number:   To,
      status:      "in_progress",
      twilio_sid:  CallSid,
    });

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const aiWebhookUrl = `${supabaseUrl}/functions/v1/twilio-ai-voice`;

    if (isBusinessHours && config.forward_to_number) {
      // Business hours: ring the owner's cell
      const actionUrl = `${aiWebhookUrl}?fallback=true&amp;callSid=${CallSid}&amp;companyId=${config.company_id}`;
      return new Response(
        `<Response>
          <Dial timeout="20" action="${actionUrl}">
            <Number>${config.forward_to_number}</Number>
          </Dial>
        </Response>`,
        { headers: { "Content-Type": "text/xml" } }
      );
    } else {
      // After hours: go straight to AI
      return new Response(
        `<Response>
          <Redirect method="POST">${aiWebhookUrl}?callSid=${CallSid}&companyId=${config.company_id}&fromNumber=${encodeURIComponent(From)}</Redirect>
        </Response>`,
        { headers: { "Content-Type": "text/xml" } }
      );
    }

  } catch (err) {
    console.error("twilio-voice-inbound error:", err);
    return new Response(
      `<Response><Say>We're sorry, we encountered an error. Please call back shortly.</Say></Response>`,
      { headers: { "Content-Type": "text/xml" } }
    );
  }
});
