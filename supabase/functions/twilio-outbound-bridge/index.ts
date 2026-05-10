// twilio-outbound-bridge — TwiML served to Dustin when he picks up an outbound call
// Tells him who he's calling, then dials the customer showing the business number

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok')

  const url = new URL(req.url)
  const to     = url.searchParams.get('to')     || ''
  const caller = url.searchParams.get('caller') || '+13372880395'

  // Format number nicely for TTS
  const clean = to.replace(/\D/g, '').slice(-10)
  const spoken = clean.length === 10
    ? `${clean.slice(0,3)}. ${clean.slice(3,6)}. ${clean.slice(6)}`
    : to

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">Connecting you to ${spoken}. The customer will see your business number. Dialing now.</Say>
  <Dial callerId="${caller}" timeout="30">
    <Number>${to}</Number>
  </Dial>
  <Say voice="alice">The customer did not answer. Goodbye.</Say>
</Response>`

  return new Response(xml, {
    headers: { 'Content-Type': 'text/xml' }
  })
})
