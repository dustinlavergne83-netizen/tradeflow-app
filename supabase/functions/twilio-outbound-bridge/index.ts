// twilio-outbound-bridge — TwiML served to the owner when they pick up an outbound call
// Tells them who they're calling, then dials the customer showing the business number.
// Honors the `record` flag from the app (previously ignored — the record toggle
// in comms-mobile did nothing before this fix).

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok')

  const url = new URL(req.url)
  const to        = url.searchParams.get('to')     || ''
  const caller    = url.searchParams.get('caller') || ''
  const companyId = url.searchParams.get('company_id') || ''
  const record    = url.searchParams.get('record') === 'true'

  // Format number nicely for TTS
  const clean = to.replace(/\D/g, '').slice(-10)
  const spoken = clean.length === 10
    ? `${clean.slice(0,3)}. ${clean.slice(3,6)}. ${clean.slice(6)}`
    : to

  const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
  const recordingCallbackUrl = `${supabaseUrl}/functions/v1/twilio-recording-callback?company_id=${encodeURIComponent(companyId)}`
  const recordAttr = record
    ? ` record="record-from-answer" recordingStatusCallback="${recordingCallbackUrl}" recordingStatusCallbackMethod="POST"`
    : ''
  const recordingAnnouncement = record
    ? `<Say voice="alice">This call is being recorded.</Say>`
    : ''

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">Connecting you to ${spoken}. The customer will see your business number. Dialing now.</Say>
  ${recordingAnnouncement}
  <Dial callerId="${caller}" timeout="30"${recordAttr}>
    <Number>${to}</Number>
  </Dial>
  <Say voice="alice">The customer did not answer. Goodbye.</Say>
</Response>`

  return new Response(xml, {
    headers: { 'Content-Type': 'text/xml' }
  })
})
