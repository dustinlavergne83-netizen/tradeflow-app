// Served when YOUR phone answers the outbound call — connects to customer
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

serve(async (req) => {
  try {
    const url = new URL(req.url);
    const to = url.searchParams.get("to") || "";
    const record = url.searchParams.get("record") === "true";
    const companyId = url.searchParams.get("company_id") || "";

    if (!to) {
      const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response><Say>Sorry, no destination number provided.</Say></Response>`;
      return new Response(twiml, { headers: { "Content-Type": "text/xml" } });
    }

    // TWILIO_CALLER_ID = your verified business number (set in Supabase secrets)
    // Falls back to TWILIO_PHONE_NUMBER (the Twilio number) if not set
    const callerId = Deno.env.get("TWILIO_CALLER_ID") || Deno.env.get("TWILIO_PHONE_NUMBER") || "";

    const recordingCallbackUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/twilio-recording-callback?company_id=${encodeURIComponent(companyId)}`;
    const recordAttr = record
      ? `record="record-from-answer" recordingStatusCallback="${recordingCallbackUrl}" recordingStatusCallbackMethod="POST"`
      : "";
    const announcement = record
      ? `<Say voice="Polly.Joanna">This call is being recorded.</Say>`
      : "";

    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  ${announcement}
  <Dial ${recordAttr} callerId="${callerId}" timeout="30" answerOnBridge="true">
    <Number statusCallback="${Deno.env.get("SUPABASE_URL")}/functions/v1/twilio-voice-inbound?company_id=${encodeURIComponent(companyId)}" statusCallbackMethod="POST">${to}</Number>
  </Dial>
</Response>`;

    return new Response(twiml, { headers: { "Content-Type": "text/xml" } });
  } catch (err) {
    console.error("twilio-connect-call error:", err);
    const twiml = `<?xml version="1.0" encoding="UTF-8"?><Response><Say>An error occurred.</Say></Response>`;
    return new Response(twiml, { headers: { "Content-Type": "text/xml" } });
  }
});
