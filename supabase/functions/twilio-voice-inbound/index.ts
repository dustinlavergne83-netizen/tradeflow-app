// twilio-voice-inbound — AI phone answering system for DML Electrical Service
// Handles: known customer routing, emergency detection, AI screening, call logging

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import OpenAI from "https://esm.sh/openai@4.20.1"

// ── Hardcoded fallbacks (overridden by twilio_config DB row) ──────────────────
const DEFAULT_COMPANY_ID      = 'c8e7a2a2-f2c4-4bfe-b35b-d81d1a4e5f3b'
const DEFAULT_PERSONAL_CELL   = '+13377177234'
const DEFAULT_BUSINESS_NUMBER = '+13372880395'
const DEFAULT_TWILIO_NUMBER   = '+13377171182'
const DEFAULT_OWNER_NAME      = 'Dustin'
const DEFAULT_BUSINESS_NAME   = 'DML Electrical Service'
const DEFAULT_SERVICE_AREA    = 'Jennings and surrounding south Louisiana areas'

const EMERGENCY_KEYWORDS = [
  'fire','smoke','burning','sparks','sparking','shocked','shock','electrocuted',
  'outage','no power','power out','breaker won\'t reset','melting','explosion',
  'exposed wire','wire down','pole down','emergency','urgent','dangerous'
]

// Load company settings from twilio_config table (keyed by phone number called)
async function loadConfig(supabase: ReturnType<typeof createClient>, toNumber: string) {
  try {
    // Try to find by the Twilio number being called
    const { data } = await supabase
      .from('twilio_config')
      .select('*')
      .or(`phone_number.eq.${toNumber},company_id.eq.${DEFAULT_COMPANY_ID}`)
      .limit(1)
      .maybeSingle()
    return data || {}
  } catch (_) { return {} }
}

function twiml(xml: string): Response {
  return new Response(`<?xml version="1.0" encoding="UTF-8"?>\n<Response>${xml}</Response>`, {
    headers: { 'Content-Type': 'text/xml' }
  })
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok')

  const url = new URL(req.url)
  const step = url.searchParams.get('step') || 'initial'

  // Parse Twilio form-encoded body
  const body = await req.text()
  const params: Record<string, string> = {}
  for (const pair of body.split('&')) {
    const [k, v] = pair.split('=')
    if (k) params[decodeURIComponent(k)] = decodeURIComponent(v || '').replace(/\+/g, ' ')
  }

  const from    = params.From    || ''
  const callSid = params.CallSid || ''
  const toNum   = params.To      || DEFAULT_TWILIO_NUMBER

  // Supabase service client
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  // Load company settings from DB (used by all steps)
  const cfg             = await loadConfig(supabase, toNum)
  const COMPANY_ID      = cfg.company_id             || DEFAULT_COMPANY_ID
  const PERSONAL_CELL   = cfg.forward_to_number      || DEFAULT_PERSONAL_CELL
  const EMERG_CELL      = cfg.emergency_forward_number || PERSONAL_CELL
  const BUSINESS_NUMBER = cfg.business_number        || DEFAULT_BUSINESS_NUMBER
  const TWILIO_NUMBER   = cfg.phone_number           || toNum
  const OWNER_NAME      = cfg.owner_name             || DEFAULT_OWNER_NAME
  const BUSINESS_NAME   = cfg.business_name          || DEFAULT_BUSINESS_NAME
  const customGreeting  = (cfg.ai_greeting || '').replace('{owner}', OWNER_NAME)
  const vipNumbers: { number: string }[] = cfg.vip_numbers || []
  const supaUrl         = Deno.env.get('SUPABASE_URL')!

  // ── Handle call status callback (saves duration when call ends) ───────────
  if (step === 'status') {
    const status   = params.CallStatus || 'completed'
    const duration = parseInt(params.CallDuration || '0')
    await supabase.from('communications')
      .update({ status, duration_seconds: duration })
      .eq('call_sid', callSid)
    return new Response('ok')
  }

  // ── Handle whisper (plays to Dustin when emergency connects) ─────────────
  if (step === 'whisper') {
    const callerNum = url.searchParams.get('from') || 'unknown'
    return twiml(`<Say voice="alice">Emergency call from ${callerNum}. Connecting now.</Say>`)
  }

  // ── Step 1: Initial call ──────────────────────────────────────────────────
  if (step === 'initial') {
    // Check if caller is a known customer
    const cleaned = from.replace(/\D/g, '').slice(-10)

    // Check VIP list first (always connects directly, no AI)
    const isVip = vipNumbers.some(v => v.number.replace(/\D/g,'').slice(-10) === cleaned)

    const { data: knownCustomer } = await supabase
      .from('communications')
      .select('customer_name, from_number')
      .ilike('from_number', `%${cleaned}`)
      .not('customer_name', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    // Also check invoices for known customers
    const { data: invoiceCustomer } = await supabase
      .from('invoices')
      .select('customer_name')
      .ilike('customer_phone', `%${cleaned}`)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const customerName = knownCustomer?.customer_name || invoiceCustomer?.customer_name

    // Log this call to communications table
    await supabase.from('communications').insert({
      company_id: COMPANY_ID,
      type: 'ai_call',
      direction: 'inbound',
      from_number: from,
      to_number: TWILIO_NUMBER,
      customer_name: customerName || null,
      status: 'ringing',
      call_sid: callSid,
    })

    const whisperUrl = `${supaUrl}/functions/v1/twilio-voice-inbound?step=whisper&from=${encodeURIComponent(customerName || from)}`
    const actionUrl  = `${supaUrl}/functions/v1/twilio-voice-inbound?step=status`

    // VIP or known customer → connect directly
    if (isVip || customerName) {
      const greeting = customerName ? `Please hold, connecting you to ${OWNER_NAME} now.` : `One moment please, connecting you now.`
      return twiml(`
        <Say voice="alice">${greeting}</Say>
        <Dial callerId="${BUSINESS_NUMBER}" action="${actionUrl}">
          <Number url="${whisperUrl}">${PERSONAL_CELL}</Number>
        </Dial>
        <Say voice="alice">Sorry, ${OWNER_NAME} is unavailable right now. Please call back or leave a message after the tone.</Say>
        <Record maxLength="60" action="${actionUrl}" />
      `)
    }

    // Unknown caller → AI greeting + gather speech
    const greeting = customGreeting || `Thank you for calling ${BUSINESS_NAME}. I'm the automated assistant. Please briefly describe what you need and I'll make sure ${OWNER_NAME} gets back to you right away.`
    const gatherUrl = `${supaUrl}/functions/v1/twilio-voice-inbound?step=analyze&from=${encodeURIComponent(from)}&sid=${encodeURIComponent(callSid)}`
    return twiml(`
      <Say voice="alice">${greeting}</Say>
      <Gather input="speech" action="${gatherUrl}" timeout="15" speechTimeout="auto" language="en-US">
        <Say voice="alice">Go ahead after the tone.</Say>
      </Gather>
      <Say voice="alice">I didn't catch that. Let me take a quick message — please leave your name and number after the tone and ${OWNER_NAME} will call you back soon.</Say>
      <Record maxLength="60" action="${supaUrl}/functions/v1/twilio-voice-inbound?step=voicemail&from=${encodeURIComponent(from)}&sid=${encodeURIComponent(callSid)}" />
    `)
  }

  // ── Step 2: Voicemail recording saved ────────────────────────────────────
  if (step === 'voicemail') {
    const recordingUrl = params.RecordingUrl || null
    const fromNum = url.searchParams.get('from') || from
    const sid = url.searchParams.get('sid') || callSid

    await supabase.from('communications')
      .update({ type: 'voicemail', recording_url: recordingUrl, status: 'voicemail' })
      .eq('call_sid', sid)

    // Send Twilio SMS to Dustin
    try {
      const sid_ = Deno.env.get('TWILIO_ACCOUNT_SID')
      const auth = Deno.env.get('TWILIO_AUTH_TOKEN')
      await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid_}/Messages.json`, {
        method: 'POST',
        headers: {
          'Authorization': 'Basic ' + btoa(`${sid_}:${auth}`),
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          From: TWILIO_NUMBER,
          To: PERSONAL_CELL,
          Body: `📞 Voicemail from ${fromNum.slice(-10)} — check DML Comms app to listen.`
        })
      })
    } catch (_) {}

    return twiml(`<Say voice="alice">Thank you. ${OWNER_NAME} will call you back soon. Goodbye!</Say><Hangup/>`)
  }

  // ── Step 3: Analyze speech with GPT-4o ───────────────────────────────────
  if (step === 'analyze') {
    const speech  = params.SpeechResult || ''
    const fromNum = url.searchParams.get('from') || from
    const sid     = url.searchParams.get('sid') || callSid
    const statusUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/twilio-voice-inbound?step=status`

    console.log('Speech from caller:', speech, 'From:', fromNum)

    if (!speech.trim()) {
      return twiml(`<Say voice="alice">I didn't catch that. ${OWNER_NAME} will call you back when he's available. Goodbye!</Say><Hangup/>`)
    }

    // Quick keyword check first (no API cost)
    const lowerSpeech = speech.toLowerCase()
    const isEmergency = EMERGENCY_KEYWORDS.some(kw => lowerSpeech.includes(kw))

    if (isEmergency) {
      // Save emergency flag
      await supabase.from('communications')
        .update({ ai_summary: `🚨 EMERGENCY: ${speech}`, status: 'emergency' })
        .eq('call_sid', sid)

      // Text Dustin immediately
      try {
        const sid_ = Deno.env.get('TWILIO_ACCOUNT_SID')
        const auth = Deno.env.get('TWILIO_AUTH_TOKEN')
        await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid_}/Messages.json`, {
          method: 'POST',
          headers: {
            'Authorization': 'Basic ' + btoa(`${sid_}:${auth}`),
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: new URLSearchParams({
            From: TWILIO_NUMBER,
            To: PERSONAL_CELL,
            Body: `🚨 EMERGENCY CALL connecting from ${fromNum.slice(-10)}: "${speech}"`
          })
        })
      } catch (_) {}

      const whisperUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/twilio-voice-inbound?step=whisper&from=EMERGENCY`
      return twiml(`
        <Say voice="alice">This sounds like an emergency. Let me connect you to ${OWNER_NAME} right away. Please hold.</Say>
        <Dial callerId="${BUSINESS_NUMBER}" action="${statusUrl}">
          <Number url="${whisperUrl}">${PERSONAL_CELL}</Number>
        </Dial>
        <Say voice="alice">Sorry, ${OWNER_NAME} is not available. Please call 911 if this is a life-threatening emergency. Otherwise leave a message after the tone.</Say>
        <Record maxLength="60" action="${statusUrl}" />
      `)
    }

    // Use GPT-4o to extract caller name and summarize
    let callerName = ''
    let summary = speech
    try {
      const openai = new OpenAI({ apiKey: Deno.env.get('OPENAI_API_KEY') })
      const resp = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [{
          role: 'user',
          content: `A customer called DML Electrical Service in Jennings, Louisiana. They said: "${speech}"
          
Extract in JSON format:
- caller_name: their first name if they said it, otherwise null
- summary: 1-sentence summary of why they called (start with what they need)
- is_emergency: true only if life-threatening electrical hazard
- response: a warm, professional 1-sentence response to say back to them confirming we got the message

Return valid JSON only.`
        }],
        max_tokens: 200,
        temperature: 0.3,
      })

      const parsed = JSON.parse(resp.choices[0].message.content || '{}')
      callerName = parsed.caller_name || ''
      summary = parsed.summary || speech
      const aiResponse = parsed.response || `Got it. ${OWNER_NAME} will call you back soon.`

      if (parsed.is_emergency) {
        const whisperUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/twilio-voice-inbound?step=whisper&from=EMERGENCY`
        await supabase.from('communications')
          .update({ ai_summary: `🚨 ${summary}`, customer_name: callerName || null, status: 'emergency' })
          .eq('call_sid', sid)
        return twiml(`
          <Say voice="alice">That sounds urgent — connecting you to ${OWNER_NAME} immediately.</Say>
          <Dial callerId="${BUSINESS_NUMBER}" action="${statusUrl}">
            <Number url="${whisperUrl}">${PERSONAL_CELL}</Number>
          </Dial>
          <Say voice="alice">Sorry, ${OWNER_NAME} is unavailable. Please leave a message after the tone.</Say>
          <Record maxLength="60" action="${statusUrl}" />
        `)
      }

      // Save summary to DB
      await supabase.from('communications')
        .update({ ai_summary: summary, customer_name: callerName || null, status: 'completed' })
        .eq('call_sid', sid)

      // Text Dustin with summary
      const cleanNum = fromNum.replace(/\D/g, '').slice(-10)
      const dispNum = `(${cleanNum.slice(0,3)}) ${cleanNum.slice(3,6)}-${cleanNum.slice(6)}`
      try {
        const twSid = Deno.env.get('TWILIO_ACCOUNT_SID')
        const twAuth = Deno.env.get('TWILIO_AUTH_TOKEN')
        await fetch(`https://api.twilio.com/2010-04-01/Accounts/${twSid}/Messages.json`, {
          method: 'POST',
          headers: {
            'Authorization': 'Basic ' + btoa(`${twSid}:${twAuth}`),
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: new URLSearchParams({
            From: TWILIO_NUMBER,
            To: PERSONAL_CELL,
            Body: `📞 New call${callerName ? ` from ${callerName}` : ''} (${dispNum}):\n"${summary}"\n\nCheck DML Comms app to call back.`
          })
        })
      } catch (_) {}

      return twiml(`<Say voice="alice">${aiResponse} Have a great day!</Say><Hangup/>`)

    } catch (e) {
      console.error('GPT error:', e)
      // Fallback: save raw speech, text Dustin
      await supabase.from('communications')
        .update({ ai_summary: speech, status: 'completed' })
        .eq('call_sid', sid)

      return twiml(`<Say voice="alice">Got it, thank you. ${OWNER_NAME} will call you back shortly. Have a great day!</Say><Hangup/>`)
    }
  }

  return twiml(`<Say voice="alice">Thank you for calling DML Electrical. Please try again shortly.</Say><Hangup/>`)
})
