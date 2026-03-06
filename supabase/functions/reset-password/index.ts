import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
    
    if (!RESEND_API_KEY) {
      throw new Error('RESEND_API_KEY is not set')
    }

    // Create a Supabase client with the service role key
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { email: rawEmail } = await req.json()
    const email = rawEmail?.trim().toLowerCase()

    if (!email) {
      return new Response(
        JSON.stringify({ error: 'Email is required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // Verify the employee exists
    const { data: employee, error: empError } = await supabaseAdmin
      .from('employees')
      .select('*')
      .eq('email', email)
      .single()

    if (empError || !employee) {
      return new Response(
        JSON.stringify({ error: 'Employee not found with that email' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      )
    }

    // Generate a new temporary password
    const tempPassword = Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-8)

    // Find the auth user by email
    const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers()
    
    if (listError) throw listError

    const authUser = users.find((u: any) => u.email === email)

    if (!authUser) {
      return new Response(
        JSON.stringify({ error: 'No auth account found for this email. The employee may need to be re-invited.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      )
    }

    // Update the user's password
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      authUser.id,
      { password: tempPassword }
    )

    if (updateError) throw updateError

    // Mark that password must be changed
    await supabaseAdmin
      .from('employees')
      .update({ password_must_change: true })
      .eq('id', employee.id)

    // Send reset email via Resend HTTP API
    const employeeName = employee.first_name 
      ? `${employee.first_name} ${employee.last_name || ''}`.trim()
      : email.split('@')[0]

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Password Reset - DML Electrical Time Clock</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          
          <!-- Header -->
          <tr>
            <td style="background-color: #0b3ea8; padding: 30px; text-align: center;">
              <h1 style="color: #f97316; margin: 0; font-size: 28px;">PASSWORD RESET</h1>
              <p style="color: #ffffff; margin: 10px 0 0 0; font-size: 14px;">DML Electrical Service, LLC</p>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 40px 30px;">
              <p style="margin: 0 0 20px 0; font-size: 16px; color: #333;">
                Hello ${employeeName},
              </p>
              
              <p style="margin: 0 0 20px 0; font-size: 16px; color: #333; line-height: 1.6;">
                Your password for the DML Electrical Time Clock has been reset by an administrator. Please use the new temporary password below to sign in.
              </p>

              <!-- Login Credentials -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin: 20px 0; border: 2px solid #0b3ea8; border-radius: 6px; overflow: hidden;">
                <tr style="background-color: #0b3ea8;">
                  <td colspan="2" style="padding: 15px; border-bottom: 2px solid #0b3ea8;">
                    <h3 style="margin: 0; color: #ffffff; font-size: 18px;">YOUR NEW LOGIN CREDENTIALS</h3>
                  </td>
                </tr>
                <tr style="background-color: #f9fafb;">
                  <td style="padding: 15px; border-bottom: 1px solid #e5e7eb; color: #666; font-weight: bold;">
                    Email:
                  </td>
                  <td style="padding: 15px; border-bottom: 1px solid #e5e7eb; text-align: right; color: #111; font-family: monospace;">
                    ${email}
                  </td>
                </tr>
                <tr style="background-color: #f9fafb;">
                  <td style="padding: 15px; color: #666; font-weight: bold;">
                    New Temporary Password:
                  </td>
                  <td style="padding: 15px; text-align: right; color: #fc6b04ff; font-weight: bold; font-family: monospace; font-size: 18px;">
                    ${tempPassword}
                  </td>
                </tr>
              </table>

              <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0;">
                <p style="margin: 0; font-size: 14px; color: #92400e; font-weight: bold;">
                  ⚠️ IMPORTANT: Please change your password after signing in!
                </p>
              </div>

              <p style="margin: 20px 0; font-size: 14px; color: #666; text-align: center;">
                Sign in at: <a href="https://timeclock.dmlelectrical.com" style="color: #0b3ea8; text-decoration: none;">timeclock.dmlelectrical.com</a>
              </p>
              
              <p style="margin: 20px 0; font-size: 16px; color: #333; line-height: 1.6;">
                If you did not expect this password reset, please contact your supervisor immediately.
              </p>

              <p style="margin: 30px 0 10px 0; font-size: 16px; color: #333;">
                Best regards,<br>
                <strong>DML Electrical Service, LLC</strong>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 20px 30px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0; font-size: 12px; color: #666;">
                This is an automated message. Please do not reply to this email.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `

    // Send email via Resend HTTP API
    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'timeclock@dmlelectrical.com',
        to: [email],
        subject: 'Password Reset - DML Electrical Time Clock',
        html: html,
      }),
    })

    const emailData = await emailRes.json()

    if (!emailRes.ok) {
      console.error('Resend API Error:', emailData)
      
      return new Response(
        JSON.stringify({ 
          success: true,
          message: 'Password was reset, but email failed to send. Share the temp password manually.',
          tempPassword,
          emailSent: false,
          emailError: emailData.message || 'Unknown error'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Password reset successfully! Email sent with new credentials.',
        tempPassword,
        emailSent: true,
        emailId: emailData.id
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error resetting password:', error)
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Failed to reset password',
        details: error.toString()
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
