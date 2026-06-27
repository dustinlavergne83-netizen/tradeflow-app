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

    // Verify caller is an admin — try by user_id first, then fall back to email
    let callerEmp: any = null
    const { data: byUid } = await supabaseAdmin
      .from('employees')
      .select('company_id, role, is_super_admin')
      .eq('user_id', user.id)
      .maybeSingle()

    if (byUid) {
      callerEmp = byUid
    } else {
      // Fallback: look up by email (handles cases where user_id wasn't stored yet)
      const { data: byEmail } = await supabaseAdmin
        .from('employees')
        .select('company_id, role, is_super_admin')
        .ilike('email', user.email ?? '')
        .maybeSingle()
      callerEmp = byEmail
    }

    const isAuthorized =
      callerEmp &&
      (
        ['admin', 'super_admin'].includes(callerEmp.role) ||
        callerEmp.is_super_admin === true
      )

    if (!isAuthorized) {
      console.error('Auth check failed. callerEmp:', JSON.stringify(callerEmp), 'user.id:', user.id, 'email:', user.email)
      return new Response(JSON.stringify({ error: 'Only admins can invite employees' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 403,
      })
    }

    const { email, firstName, lastName, phone, role, hourlyRate } = await req.json()

    if (!email) {
      return new Response(JSON.stringify({ error: 'email is required' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    // Always use the caller's own company_id — prevents cross-company invites
    const companyId = callerEmp.company_id

    // Normalise optional fields
    const safeFirst = (firstName || '').trim()
    const safeLast  = (lastName  || '').trim()

    const cleanEmail = email.toLowerCase().trim()
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')

    // Generate an invite link via Supabase admin (doesn't send email — we send via Resend)
    const SITE_URL = Deno.env.get('SITE_URL') || 'https://tradeflow-app.vercel.app'
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'invite',
      email: cleanEmail,
      options: {
        redirectTo: `${SITE_URL}/set-password`,
        data: {
          first_name: safeFirst,
          last_name:  safeLast,
          company_id: companyId,
        },
      },
    })

    // If "already registered" (confirmed user), generate a magic link / password reset instead
    let inviteLink: string | null = linkData?.properties?.action_link ?? null
    let newUserId: string | null = linkData?.user?.id ?? null

    if (linkError) {
      console.error('generateLink(invite) error:', linkError.message)
      const alreadyExists =
        linkError.message.toLowerCase().includes('already') ||
        linkError.message.toLowerCase().includes('registered') ||
        linkError.message.toLowerCase().includes('exists')

      if (!alreadyExists) {
        return new Response(JSON.stringify({ error: linkError.message }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        })
      }

      // User already exists — find them so we have their id
      const { data: { users: allUsers } } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 })
      const existingUser = allUsers?.find((u: any) => u.email?.toLowerCase() === cleanEmail)
      newUserId = existingUser?.id ?? null
      const isConfirmed = !!existingUser?.email_confirmed_at

      // For confirmed users use recovery (password reset); for unconfirmed use magiclink
      // magiclink works for ALL states and lets them land on /set-password
      const fallbackType = isConfirmed ? 'recovery' : 'magiclink'
      console.log(`User already exists (confirmed=${isConfirmed}), generating ${fallbackType} link`)

      const { data: fallbackData, error: fallbackError } = await supabaseAdmin.auth.admin.generateLink({
        type: fallbackType as any,
        email: cleanEmail,
        options: { redirectTo: `${SITE_URL}/set-password` },
      })
      if (fallbackError) {
        console.error(`generateLink(${fallbackType}) error:`, fallbackError.message)
        return new Response(JSON.stringify({ error: fallbackError.message }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        })
      }
      inviteLink = fallbackData?.properties?.action_link ?? null
      newUserId  = fallbackData?.user?.id ?? newUserId
    }

    if (!inviteLink) {
      return new Response(JSON.stringify({ error: 'Failed to generate invite link' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    // Upsert the employee record (handles re-invites without duplicates)
    const { error: upsertEmpError } = await supabaseAdmin
      .from('employees')
      .upsert(
        {
          company_id:  companyId,
          user_id:     newUserId,
          first_name:  safeFirst,
          last_name:   safeLast,
          phone:       phone?.trim() || null,
          email:       cleanEmail,
          role:        role || 'employee',
          hourly_rate: hourlyRate ? parseFloat(String(hourlyRate)) : null,
          is_active:   true,
        },
        { onConflict: 'email' }
      )

    if (upsertEmpError) {
      console.error('Employee upsert error:', upsertEmpError)
      return new Response(JSON.stringify({ error: upsertEmpError.message }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    // Send the invite email via Resend (same service used for invoices/estimates)
    let emailSent = false
    let emailError = ''

    if (RESEND_API_KEY) {
      const emailHtml = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;font-family:Arial,sans-serif;background-color:#f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f5f5;padding:20px;">
    <tr><td align="center">
      <table width="520" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.12);">
        <tr>
          <td style="background-color:#0b3ea8;padding:32px;text-align:center;">
            <h1 style="color:#fc6b04;margin:0 0 8px 0;font-size:28px;">🔧 TradeFlow</h1>
            <p style="color:#ffffff;margin:0;font-size:16px;">You've been invited!</p>
          </td>
        </tr>
        <tr>
          <td style="padding:32px;">
            <p style="font-size:16px;color:#111;margin:0 0 16px 0;">Hi${safeFirst ? ' ' + safeFirst : ''},</p>
            <p style="font-size:15px;color:#374151;line-height:1.7;margin:0 0 24px 0;">
              You've been invited to join <strong>TradeFlow</strong> — the all-in-one platform for managing your work schedule, timesheets, and payroll.
            </p>
            <table width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;">
              <tr><td align="center">
                <a href="${inviteLink}" style="display:inline-block;padding:16px 40px;background-color:#fc6b04;color:#ffffff;text-decoration:none;border-radius:8px;font-size:17px;font-weight:bold;">
                  ✅ Accept Invite &amp; Set Password
                </a>
              </td></tr>
            </table>
            <p style="font-size:13px;color:#6b7280;margin:0 0 8px 0;">Button not working? Copy and paste this link:</p>
            <p style="font-size:12px;color:#0b3ea8;word-break:break-all;margin:0 0 24px 0;">${inviteLink}</p>
            <div style="background-color:#fef3c7;border-left:4px solid #f59e0b;border-radius:4px;padding:12px 16px;margin-bottom:24px;">
              <p style="margin:0;font-size:13px;color:#92400e;">⏰ This link expires in <strong>24 hours</strong>. If it expires, ask your admin to resend the invite.</p>
            </div>
            <p style="font-size:14px;color:#374151;margin:0;">
              Once you set your password you can sign in at:<br>
              <a href="https://app.tradeflowllc.com" style="color:#0b3ea8;">https://app.tradeflowllc.com</a>
            </p>
          </td>
        </tr>
        <tr>
          <td style="background-color:#f9fafb;padding:16px 32px;text-align:center;border-top:1px solid #e5e7eb;">
            <p style="margin:0;font-size:12px;color:#6b7280;">TradeFlow — Built for the Trades</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`

      const uniqueId = Date.now().toString(36)
      const resendRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: 'DML Electrical Service <noreply@dmlelectrical.com>',
          to: [cleanEmail],
          subject: `Action required: Set up your TradeFlow account [${uniqueId}]`,
          html: emailHtml,
          headers: { 'X-Entity-Ref-ID': `invite-${cleanEmail}-${uniqueId}` },
        }),
      })
      const resendBody = await resendRes.json()
      if (!resendRes.ok) {
        emailError = resendBody.message || resendBody.name || JSON.stringify(resendBody)
        console.error('Resend error sending invite:', emailError)
      } else {
        emailSent = true
        console.log('Invite email sent via Resend, id:', resendBody.id)
      }
    } else {
      emailError = 'RESEND_API_KEY not configured'
      console.warn(emailError)
    }

    return new Response(
      JSON.stringify({
        success: true,
        emailSent,
        emailError: emailError || null,
        message: emailSent
          ? `Invite sent to ${cleanEmail}`
          : `Employee record created but email failed: ${emailError}`,
      }),
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
