// twilio-outbound-call — makes an outbound call from the comms app
// Shows the calling company's business number as caller ID to the customer
// Rings the company's forward_to_number (owner's cell) first, then bridges to customer
//
// Fully multi-tenant: everything (numbers + Twilio credentials) is loaded from
// the twilio_config row for the requesting company_id. No hardcoded company data.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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
    if (!company_id) {
      return new Response(JSON.stringify({ error: 'company_id required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabase = createClient(
      supabaseUrl,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Load this company's Twilio configuration — required, no DML fallback
    const { data: cfg, error: cfgError } = await supabase
      .from('twilio_config')
      .select('*')
      .eq('company_id', company_id)
      .maybeSingle()

    if (cfgError || !cfg) {
      return new Response(JSON.stringify({ error: 'Twilio is not configured for this company' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
    if (!cfg.forward_to_number) {
      return new Response(JSON.stringify({ error: 'No forward-to number configured for this company' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const businessNumber = cfg.business_number || cfg.phone_number
    const forwardToNumber = cfg.forward_to_number

    // Prefer this company's own Twilio credentials; fall back to the global
    // account secrets so a company can share the platform account until it
    // gets its own subaccount/credentials.
    const twSid  = cfg.account_sid || Deno.env.get('TWILIO_ACCOUNT_SID')
    const twAuth = cfg.auth_token  || Deno.env.get('TWILIO_AUTH_TOKEN')

    if (!twSid || !twAuth) {
      return new Response(JSON.stringify({ error: 'Twilio credentials are not configured for this company' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // TwiML that bridges the owner's answered call to the customer
    // When the owner picks up, it dials out to the customer
    const twimlUrl = `${supabaseUrl}/functions/v1/twilio-outbound-bridge`
      + `?to=${encodeURIComponent(to_customer)}`
      + `&caller=${encodeURIComponent(businessNumber)}`
      + `&company_id=${encodeURIComponent(company_id)}`
      + `&record=${record ? 'true' : 'false'}`

    // Create the call: ring the owner's cell first
    const resp = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${twSid}/Calls.json`, {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + btoa(`${twSid}:${twAuth}`),
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        From: businessNumber,     // Business number rings the owner's cell
        To:   forwardToNumber,    // Rings the owner first
        Url:  twimlUrl,           // When the owner answers, bridge to customer
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
    await supabase.from('communications').insert({
      company_id,
      type: 'call',
      direction: 'outbound',
      from_number: businessNumber,
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

