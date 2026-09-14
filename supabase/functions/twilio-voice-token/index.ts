// twilio-voice-token — mints a Twilio Voice Access Token for the calling app
// (comms-mobile in-app "softphone"). Called by the app on sign-in / app start
// so the Twilio Voice SDK can register for incoming calls and place outgoing
// calls, without any Twilio credentials ever touching the client.
//
// Security: identity is derived from the caller's own Supabase session — never
// trusted from the request body. This prevents one employee from registering
// as (and receiving calls meant for) another employee or another company.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { create, getNumericDate } from 'https://deno.land/x/djwt@v3.0.2/mod.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Twilio Access Tokens are JWTs signed with an API Key Secret (HS256), with a
// specific set of Twilio-flavored claims. The djwt library only needs an
// HMAC CryptoKey — build one from the API Key Secret.
async function importHmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseAdmin = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '')
    const supabaseUser = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
      global: { headers: { Authorization: authHeader } }
    })

    const { data: { user }, error: userError } = await supabaseUser.auth.getUser()
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Look up the caller's employee record — this is the ONLY source of
    // identity and company_id. Never trust client-supplied values here.
    const { data: emp, error: empError } = await supabaseAdmin
      .from('employees')
      .select('id, company_id, first_name, last_name')
      .eq('user_id', user.id)
      .maybeSingle()

    if (empError || !emp || !emp.company_id) {
      return new Response(JSON.stringify({ error: 'No employee record found for this account' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Look up this company's Twilio config (TwiML App SID may be per-company
    // in future; for now everyone shares the platform TwiML App via secrets
    // unless the company's twilio_config row overrides it).
    const { data: cfg } = await supabaseAdmin
      .from('twilio_config')
      .select('twiml_app_sid')
      .eq('company_id', emp.company_id)
      .maybeSingle()

    const accountSid   = Deno.env.get('TWILIO_ACCOUNT_SID') ?? ''
    const apiKeySid    = Deno.env.get('TWILIO_API_KEY_SID') ?? ''
    const apiKeySecret = Deno.env.get('TWILIO_API_KEY_SECRET') ?? ''
    const twimlAppSid  = cfg?.twiml_app_sid || Deno.env.get('TWILIO_TWIML_APP_SID') || ''

    if (!accountSid || !apiKeySid || !apiKeySecret || !twimlAppSid) {
      return new Response(JSON.stringify({ error: 'Twilio Voice softphone is not configured yet (missing API Key / TwiML App secrets)' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Identity is derived from the employee row, NOT user-suppliable. This is
    // what routing_contacts.client_identity in twilio_config points at, and
    // what Twilio uses as the <Client> name when dialing this person.
    const identity = `emp_${emp.id}`

    const now = getNumericDate(0)
    const exp = getNumericDate(60 * 60) // 1 hour

    const grants: Record<string, unknown> = {
      identity,
      voice: {
        outgoing: { application_sid: twimlAppSid },
        incoming: { allow: true },
        push_credential_sid: Deno.env.get('TWILIO_PUSH_CREDENTIAL_SID') || undefined,
      },
    }

    const payload = {
      jti: `${apiKeySid}-${now}`,
      iss: apiKeySid,
      sub: accountSid,
      exp,
      nbf: now,
      grants,
    }

    const key = await importHmacKey(apiKeySecret)
    const token = await create(
      { alg: 'HS256', typ: 'JWT', cty: 'twilio-fpa;v=1' },
      payload,
      key
    )

    return new Response(JSON.stringify({
      token,
      identity,
      company_id: emp.company_id,
      expires_at: exp,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (e: any) {
    console.error('twilio-voice-token error:', e)
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
