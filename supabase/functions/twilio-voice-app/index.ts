// twilio-voice-app — TwiML endpoint for the TwiML Application's "Voice
// Request URL". This is what Twilio calls when the in-app softphone
// (lib/TwilioVoice.ts connectVoiceCall) places an outgoing call via
// `voice.connect(token, { params })`. Twilio POSTs those params here as
// form fields, and this returns TwiML dialing the actual customer number,
// showing the company's business number as caller ID — mirroring what
// twilio-outbound-call does for the cell-forwarding path.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

function twiml(xml: string): Response {
  return new Response(`<?xml version="1.0" encoding="UTF-8"?>\n<Response>${xml}</Response>`, {
    headers: { 'Content-Type': 'text/xml' }
  })
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok')

  try {
    const body = await req.text()
    const params = new URLSearchParams(body)
    const toCustomer = params.get('to_customer') || ''
    const companyId  = params.get('company_id') || ''
    const record     = params.get('record') === 'true'

    if (!toCustomer) {
      return twiml(`<Say voice="Polly.Joanna-Neural">Sorry, no destination number was provided.</Say>`)
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { data: cfg } = await supabase
      .from('twilio_config')
      .select('business_number, phone_number')
      .eq('company_id', companyId)
      .maybeSingle()

    const callerId = cfg?.business_number || cfg?.phone_number || ''
    const supaUrl = Deno.env.get('SUPABASE_URL')
    const recordingCallbackUrl = `${supaUrl}/functions/v1/twilio-recording-callback?company_id=${encodeURIComponent(companyId)}`
    const recordAttr = record
      ? ` record="record-from-answer" recordingStatusCallback="${recordingCallbackUrl}" recordingStatusCallbackMethod="POST"`
      : ''

    // Log the outbound call the same way twilio-outbound-call does, so it
    // shows up in the app's Recents tab regardless of which path was used.
    await supabase.from('communications').insert({
      company_id: companyId,
      type: 'call',
      direction: 'outbound',
      from_number: callerId,
      to_number: toCustomer,
      status: 'initiated',
    })

    return twiml(`<Dial callerId="${callerId}" timeout="30"${recordAttr}><Number>${toCustomer}</Number></Dial>`)

  } catch (e) {
    console.error('twilio-voice-app error:', e)
    return twiml(`<Say voice="Polly.Joanna-Neural">Sorry, something went wrong placing your call.</Say>`)
  }
})
