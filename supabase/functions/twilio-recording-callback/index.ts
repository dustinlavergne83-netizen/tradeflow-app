// Saves recording URL + transcription after a call is recorded
// Called by Twilio when recording is complete (voicemail or call recording)
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  try {
    const url = new URL(req.url);
    const companyId = url.searchParams.get("company_id") || "";
    const isVoicemail = url.searchParams.get("voicemail") === "true";

    const body = await req.text();
    const params = new URLSearchParams(body);

    const callSid = params.get("CallSid") || "";
    const recordingSid = params.get("RecordingSid") || "";
    const recordingUrl = params.get("RecordingUrl") || "";
    const recordingDuration = parseInt(params.get("RecordingDuration") || "0");
    const transcriptionText = params.get("TranscriptionText") || null;
    const fromNumber = params.get("From") || params.get("Caller") || "";
    const toNumber = params.get("To") || params.get("Called") || "";

    if (!recordingUrl && !recordingSid) {
      return new Response("OK", { status: 200 });
    }

    // Build the full recording URL (Twilio recording URLs need .mp3 extension)
    const fullRecordingUrl = recordingUrl
      ? `${recordingUrl}.mp3`
      : `https://api.twilio.com/2010-04-01/Accounts/AC.../Recordings/${recordingSid}.mp3`;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    if (isVoicemail) {
      // Insert as a new voicemail entry
      if (!companyId || !fromNumber) {
        return new Response("Missing company_id or from_number", { status: 400 });
      }

      // Try to match customer
      let customerName = null;
      let customerId = null;
      try {
        const { data: customer } = await supabase
          .from("customers")
          .select("id, name")
          .eq("company_id", companyId)
          .ilike("phone", `%${fromNumber.replace(/\D/g, "").slice(-10)}%`)
          .maybeSingle();
        if (customer) { customerName = customer.name; customerId = customer.id; }
      } catch (_) {}

      await supabase.from("communications").insert({
        company_id: companyId,
        type: "voicemail",
        direction: "inbound",
        from_number: fromNumber,
        to_number: toNumber,
        customer_name: customerName,
        customer_id: customerId,
        recording_url: fullRecordingUrl,
        recording_sid: recordingSid,
        duration_seconds: recordingDuration,
        ai_summary: transcriptionText,
        call_sid: callSid,
        status: "completed",
        created_at: new Date().toISOString(),
      });
    } else {
      // Update existing call record with recording info
      if (callSid) {
        await supabase.from("communications")
          .update({
            recording_url: fullRecordingUrl,
            recording_sid: recordingSid,
            duration_seconds: recordingDuration,
            ai_summary: transcriptionText,
          })
          .eq("call_sid", callSid);
      }
    }

    return new Response("OK", { status: 200 });
  } catch (err) {
    console.error("twilio-recording-callback error:", err);
    return new Response("Error", { status: 500 });
  }
});
