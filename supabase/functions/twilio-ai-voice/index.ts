import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// AI-powered voice conversation handler.
// Twilio calls this webhook for each speech turn.
// Uses OpenAI to generate responses, saves full transcript.

const SYSTEM_PROMPT = `You are a professional after-hours receptionist for DML Electrical Service LLC, 
a licensed electrical contractor in Jennings, Louisiana, owned by Dustin Lavergne.

Your goals (in order):
1. Greet the caller warmly and professionally
2. Find out: is this an EMERGENCY or a regular service request?
3. Collect: caller's full name, best callback number, address or city, and description of the issue
4. For EMERGENCIES (no power, burning smell, sparks, flooding near electrical, danger): 
   - Say you are immediately alerting the on-call technician
   - Get their info quickly and urgently
5. For NON-EMERGENCIES:
   - Confirm you'll have someone call them back first thing the next business day
6. Close the call warmly

Company info:
- Company: DML Electrical Service LLC
- Owner: Dustin Lavergne  
- Phone: (337) 288-0395
- Services: Residential & commercial wiring, standby generators, sports & outdoor lighting, EV chargers, agricultural electrical
- Service Area: Southwest Louisiana (Jennings, Lake Charles, Lafayette, Sulphur, Crowley, Rayne, Iowa, Welsh)
- Hours: Mon-Fri 7am-6pm | 24/7 for emergencies

Rules:
- Never quote specific prices — say "we'll give you a free written estimate"
- Always be warm, calm, and professional
- Keep responses SHORT (2-3 sentences max) — this is a phone call
- After collecting all info, summarize what you heard and confirm it
- End the call by saying "We'll be in touch. Thank you for calling DML Electrical."`;

serve(async (req) => {
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const openaiKey = Deno.env.get("OPENAI_API_KEY");

    const url = new URL(req.url);
    const callSid    = url.searchParams.get("callSid") || "";
    const companyId  = url.searchParams.get("companyId") || "";
    const fromNumber = url.searchParams.get("fromNumber") || "";
    const isFallback = url.searchParams.get("fallback") === "true";

    const text = await req.text();
    const params = new URLSearchParams(text);
    const SpeechResult  = params.get("SpeechResult") || "";
    const DialCallStatus = params.get("DialCallStatus") || ""; // for fallback after forward

    // Load existing conversation transcript
    const { data: commRecord } = await supabase
      .from("communications")
      .select("*")
      .eq("twilio_sid", callSid)
      .maybeSingle();

    const existingTranscript: { role: string; content: string }[] =
      commRecord?.transcript || [];

    // If this is the very first call (no speech yet), greet the caller
    if (!SpeechResult && !isFallback) {
      const greeting = "Thank you for calling DML Electrical Service. You've reached our after-hours line. I'm here to help. Is this an electrical emergency, or is this a general service request?";
      
      await updateTranscript(supabase, callSid, companyId, fromNumber, existingTranscript, null, greeting);

      return new Response(buildGatherResponse(greeting, req.url), {
        headers: { "Content-Type": "text/xml" },
      });
    }

    // If forwarded call was not answered → take a message
    if (isFallback && DialCallStatus !== "completed") {
      const msg = "It looks like we weren't able to connect you with our team right now. Please stay on the line and I'll take a message for you. What's your name and how can we help?";
      return new Response(buildGatherResponse(msg, req.url.replace("fallback=true", "fallback=false")), {
        headers: { "Content-Type": "text/xml" },
      });
    }

    // Build messages array for OpenAI
    const messages = [
      { role: "system", content: SYSTEM_PROMPT },
      ...existingTranscript,
    ];
    if (SpeechResult) {
      messages.push({ role: "user", content: SpeechResult });
    }

    // Call OpenAI
    let aiResponse = "I'm sorry, I'm having trouble processing that. Could you please repeat yourself?";
    
    if (openaiKey) {
      const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${openaiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages,
          max_tokens: 200,
          temperature: 0.7,
        }),
      });
      const aiData = await aiRes.json();
      aiResponse = aiData.choices?.[0]?.message?.content || aiResponse;
    }

    // Update transcript
    const newTranscript = [
      ...existingTranscript,
      ...(SpeechResult ? [{ role: "user", content: SpeechResult }] : []),
      { role: "assistant", content: aiResponse },
    ];

    await updateTranscript(supabase, callSid, companyId, fromNumber, newTranscript, SpeechResult, aiResponse);

    // Detect if call should end
    const endPhrases = ["thank you for calling dml", "we'll be in touch", "goodbye", "have a great"];
    const shouldEnd = endPhrases.some(p => aiResponse.toLowerCase().includes(p));

    if (shouldEnd) {
      return new Response(
        `<Response><Say voice="Polly.Joanna">${escapeXml(aiResponse)}</Say><Hangup/></Response>`,
        { headers: { "Content-Type": "text/xml" } }
      );
    }

    return new Response(buildGatherResponse(aiResponse, req.url), {
      headers: { "Content-Type": "text/xml" },
    });

  } catch (err) {
    console.error("twilio-ai-voice error:", err);
    return new Response(
      `<Response><Say>We're experiencing a technical issue. Please call back during business hours at 3 3 7, 2 8 8, 0 3 9 5. Thank you.</Say><Hangup/></Response>`,
      { headers: { "Content-Type": "text/xml" } }
    );
  }
});

function buildGatherResponse(sayText: string, webhookUrl: string): string {
  // Strip query params for cleaner webhook URL
  const baseUrl = webhookUrl.split("?")[0];
  const url = new URL(webhookUrl);
  const callSid   = url.searchParams.get("callSid") || "";
  const companyId = url.searchParams.get("companyId") || "";
  const fromNumber = url.searchParams.get("fromNumber") || "";

  return `<Response>
    <Gather input="speech" timeout="5" speechTimeout="auto" action="${baseUrl}?callSid=${callSid}&companyId=${companyId}&fromNumber=${encodeURIComponent(fromNumber)}" method="POST">
      <Say voice="Polly.Joanna">${escapeXml(sayText)}</Say>
    </Gather>
    <Say voice="Polly.Joanna">I didn't catch that. Please call back at 3 3 7, 2 8 8, 0 3 9 5 during business hours. Thank you for calling DML Electrical.</Say>
    <Hangup/>
  </Response>`;
}

async function updateTranscript(
  supabase: ReturnType<typeof createClient>,
  callSid: string,
  companyId: string,
  fromNumber: string,
  transcript: { role: string; content: string }[],
  userMessage: string | null,
  aiMessage: string
) {
  const newTranscript = [
    ...transcript.filter(t => !(t.role === "assistant" && t.content === aiMessage)),
    ...(userMessage ? [{ role: "user", content: userMessage }] : []),
    { role: "assistant", content: aiMessage },
  ];

  // Generate a quick AI summary every few turns
  let aiSummary = null;
  if (newTranscript.length >= 6) {
    const userMessages = newTranscript
      .filter(t => t.role === "user")
      .map(t => t.content)
      .join(" | ");
    aiSummary = `After-hours AI call. Caller said: ${userMessages.substring(0, 300)}`;
  }

  const { error } = await supabase
    .from("communications")
    .update({
      transcript: newTranscript,
      ai_summary: aiSummary,
      status: "in_progress",
    })
    .eq("twilio_sid", callSid);

  if (error && callSid) {
    // Record may not exist yet — insert it
    await supabase.from("communications").insert({
      company_id:  companyId,
      type:        "ai_call",
      direction:   "inbound",
      from_number: fromNumber,
      to_number:   "",
      transcript:  newTranscript,
      ai_summary:  aiSummary,
      status:      "in_progress",
      twilio_sid:  callSid,
    });
  }
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
