import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Parse Twilio's form-encoded body
    const text = await req.text();
    const params = new URLSearchParams(text);
    const From      = params.get("From") || "";
    const To        = params.get("To") || "";
    const Body      = params.get("Body") || "";
    const MessageSid = params.get("MessageSid") || "";

    // Find company by Twilio number
    const { data: config } = await supabase
      .from("twilio_config")
      .select("*")
      .eq("phone_number", To)
      .single();

    if (!config) {
      return new Response('<Response></Response>', { headers: { "Content-Type": "text/xml" } });
    }

    // Try to match caller to an existing customer
    const fromNormalized = From.replace(/\D/g, "").slice(-10);
    const { data: customers } = await supabase
      .from("customers")
      .select("id, name, phone")
      .eq("company_id", config.company_id);

    let matchedCustomer = null;
    if (customers) {
      matchedCustomer = customers.find(c => {
        const cPhone = (c.phone || "").replace(/\D/g, "").slice(-10);
        return cPhone === fromNormalized && cPhone.length === 10;
      });
    }

    // Save inbound message
    await supabase.from("communications").insert({
      company_id:    config.company_id,
      customer_id:   matchedCustomer?.id || null,
      customer_name: matchedCustomer?.name || null,
      type:          "sms",
      direction:     "inbound",
      from_number:   From,
      to_number:     To,
      body:          Body,
      status:        "completed",
      twilio_sid:    MessageSid,
    });

    // Check if outside business hours → auto-reply
    let replyXml = '<Response></Response>';

    if (config.sms_auto_reply_enabled) {
      const now = new Date();
      const tz = config.timezone || "America/Chicago";
      const localTime = new Intl.DateTimeFormat("en-US", {
        timeZone: tz, hour: "numeric", weekday: "short", hour12: false,
      }).formatToParts(now);
      const hour    = parseInt(localTime.find(p => p.type === "hour")?.value || "12");
      const weekday = localTime.find(p => p.type === "weekday")?.value || "Mon";

      const isBusinessDay = (config.business_days || ["Mon","Tue","Wed","Thu","Fri"]).includes(weekday);
      const isBusinessHour = hour >= (config.business_hours_start || 7) && hour < (config.business_hours_end || 18);
      const isBusinessHours = isBusinessDay && isBusinessHour;

      if (!isBusinessHours) {
        const autoReplyMsg = config.sms_auto_reply_message ||
          "Thanks for texting DML Electrical! We received your message and will respond during business hours (Mon-Fri 7am-6pm).";

        // Save outbound auto-reply
        await supabase.from("communications").insert({
          company_id:    config.company_id,
          customer_id:   matchedCustomer?.id || null,
          customer_name: matchedCustomer?.name || null,
          type:          "sms",
          direction:     "outbound",
          from_number:   To,
          to_number:     From,
          body:          autoReplyMsg,
          status:        "completed",
        });

        replyXml = `<Response><Message>${autoReplyMsg}</Message></Response>`;
      }
    }

    return new Response(replyXml, { headers: { "Content-Type": "text/xml" } });

  } catch (err) {
    console.error("twilio-inbound-sms error:", err);
    return new Response('<Response></Response>', { headers: { "Content-Type": "text/xml" } });
  }
});
