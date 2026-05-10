// twilio-outbound-call — makes an outbound call from the comms app
// Shows business caller ID (337) 288-0395 to the customer
// Rings Dustin's personal cell first, then bridges to customer

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const TWILIO_NUMBER   = '+13377171182'   // Twilio number (for logging)
const BUSINESS_NUMBER = '+13372880395'   // Shows as caller ID to customer
const PERSONAL_CELL   = '+13377177234'   // Rings Dustin first
const COMPANY_ID      = 'c8e7a2a2-f2c4-4bfe-b35b-d81d1a4e5f3b'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { to_customer, company_id, customer_name, record } = await req.json()

    if (!to_customer) {
      return new Response(JSON.stringify({ error: 'to_customer required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const twSid  = Deno.env.get('TWILIO_ACCOUNT_SID')
    const twAuth = Deno.env.get('TWILIO_AUTH_TOKEN')
    const supabaseUrl = Deno.env.get('SUPABASE_URL')

    // TwiML that bridges Dustin's answered call to the customer
    // When Dustin picks up, it dials out to the customer
    const twimlUrl = `${supabaseUrl}/functions/v1/twilio-outbound-bridge?to=${encodeURIComponent(to_customer)}&caller=${encodeURIComponent(BUSINESS_NUMBER)}`

    // Create the call: ring Dustin's personal cell first
    const resp = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${twSid}/Calls.json`, {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + btoa(`${twSid}:${twAuth}`),
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        From: BUSINESS_NUMBER,   // Business number rings Dustin's cell
        To:   PERSONAL_CELL,    // Rings Dustin first
        Url:  twimlUrl,         // When Dustin answers, bridge to customer
        StatusCallback: `${supabaseUrl}/functions/v1/twilio-voice-inbound?step=status`,
        StatusCallbackMethod: 'POST',
      })
    })

    const data = await resp.json()

    if (!resp.ok) {
      console.error('Twilio error:', data)
      return new Response(JSON.stringify({ error: data.message || 'Twilio error' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Log the outbound call
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )
    await supabase.from('communications').insert({
      company_id: company_id || COMPANY_ID,
      type: 'call',
      direction: 'outbound',
      from_number: BUSINESS_NUMBER,
      to_number: to_customer,
      customer_name: customer_name || null,
      status: 'initiated',
      call_sid: data.sid,
    })

    return new Response(JSON.stringify({ success: true, sid: data.sid }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
