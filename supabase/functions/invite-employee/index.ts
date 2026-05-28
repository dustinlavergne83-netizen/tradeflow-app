// invite-employee: Sends a Supabase invite email and creates the employee record
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Verify caller is authenticated
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      })
    }

    // Admin client (service role) — can call auth.admin.*
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // User client — verify the caller's session and role
    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user }, error: userError } = await supabaseUser.auth.getUser()
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      })
    }

    // Verify caller is an admin in the employees table
    const { data: callerEmp, error: empLookupError } = await supabaseAdmin
      .from('employees')
      .select('company_id, role')
      .eq('user_id', user.id)
      .maybeSingle()

    if (empLookupError || !callerEmp || callerEmp.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Only admins can invite employees' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 403,
      })
    }

    const { email, firstName, lastName, phone, role, hourlyRate, companyId } = await req.json()

    if (!email || !firstName || !companyId) {
      return new Response(JSON.stringify({ error: 'email, firstName, and companyId are required' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    // Security: caller can only invite to their own company
    if (callerEmp.company_id !== companyId) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 403,
      })
    }

    // Send the Supabase invite email (uses configured SMTP → noreply@tradeflowllc.com)
    const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
      email.toLowerCase().trim(),
      {
        redirectTo: 'https://app.tradeflowllc.com',
        data: {
          first_name: firstName.trim(),
          last_name: (lastName || '').trim(),
          company_id: companyId,
        },
      }
    )

    if (inviteError) {
      console.error('Invite error:', inviteError)
      return new Response(JSON.stringify({ error: inviteError.message }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    const newUserId = inviteData.user?.id ?? null

    // Create the employee record immediately
    const { error: createEmpError } = await supabaseAdmin.from('employees').insert({
      company_id:  companyId,
      user_id:     newUserId,
      first_name:  firstName.trim(),
      last_name:   (lastName || '').trim(),
      phone:       phone?.trim() || null,
      email:       email.toLowerCase().trim(),
      role:        role || 'employee',
      hourly_rate: hourlyRate ? parseFloat(String(hourlyRate)) : null,
      is_active:   true,
    })

    if (createEmpError) {
      console.error('Employee create error:', createEmpError)
      // Clean up the auth user if employee row failed
      if (newUserId) {
        await supabaseAdmin.auth.admin.deleteUser(newUserId)
      }
      return new Response(JSON.stringify({ error: createEmpError.message }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    return new Response(
      JSON.stringify({ success: true, message: `Invite sent to ${email}` }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Invite employee error:', error)
    return new Response(
      JSON.stringify({ success: false, error: error.message || 'Failed to send invite' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  }
})
