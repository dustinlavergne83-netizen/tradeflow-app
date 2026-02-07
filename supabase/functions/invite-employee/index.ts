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
    const email = rawEmail.trim().toLowerCase()

    if (!email) {
      return new Response(
        JSON.stringify({ error: 'Email is required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // Create or get the employee record
    const firstName = email.split('@')[0]
    let employee
    
    // Try to create employee
    const { data: newEmployee, error: employeeError } = await supabaseAdmin
      .from('employees')
      .insert({
        email,
        first_name: firstName,
        last_name: '',
        role: 'employee',
        is_active: true,
       password_must_change: true  // Force password change on first login

      })
      .select()
      .single()

    if (employeeError) {
      // If employee already exists, fetch it
      if (employeeError.code === '23505') {
        const { data: existingEmployee, error: fetchError } = await supabaseAdmin
          .from('employees')
          .select()
          .eq('email', email)
          .single()
        
        if (fetchError) throw fetchError
        employee = existingEmployee
      } else {
        throw employeeError
      }
    } else {
      employee = newEmployee
    }

    // Generate temporary password
    const tempPassword = Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-8)

    // Create auth user with admin privileges (bypasses email confirmation)
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true, // Auto-confirm the email
    })

    if (authError) {
      // If auth creation fails, delete the employee record to keep things consistent
      await supabaseAdmin.from('employees').delete().eq('id', employee.id)
      throw authError
    }

    // Link the auth user_id to the employee record
    const { error: updateError } = await supabaseAdmin
      .from('employees')
      .update({ user_id: authData.user.id })
      .eq('id', employee.id)

    if (updateError) {
      console.error('Failed to link user_id to employee:', updateError)
      // Don't throw - employee and auth user are created, just log the warning
    }

    // Send welcome email with credentials
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to DML Electrical Time Clock</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          
          <!-- Header -->
          <tr>
            <td style="background-color: #0b3ea8; padding: 30px; text-align: center;">
              <h1 style="color: #f97316; margin: 0; font-size: 28px;">WELCOME</h1>
              <p style="color: #ffffff; margin: 10px 0 0 0; font-size: 14px;">DML Electrical Service, LLC</p>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 40px 30px;">
              <p style="margin: 0 0 20px 0; font-size: 16px; color: #333;">
                Hello,
              </p>
              
              <p style="margin: 0 0 20px 0; font-size: 16px; color: #333; line-height: 1.6;">
                Your employee account has been created for the DML Electrical Time Clock system. You can now clock in and out using our mobile app or web portal.
              </p>

              <!-- Login Credentials -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin: 20px 0; border: 2px solid #0b3ea8; border-radius: 6px; overflow: hidden;">
                <tr style="background-color: #0b3ea8;">
                  <td colspan="2" style="padding: 15px; border-bottom: 2px solid #0b3ea8;">
                    <h3 style="margin: 0; color: #ffffff; font-size: 18px;">YOUR LOGIN CREDENTIALS</h3>
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
                    Temporary Password:
                  </td>
                  <td style="padding: 15px; text-align: right; color: #fc6b04ff; font-weight: bold; font-family: monospace; font-size: 18px;">
                    ${tempPassword}
                  </td>
                </tr>
              </table>

              <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0;">
                <p style="margin: 0; font-size: 14px; color: #92400e; font-weight: bold;">
                  ⚠️ IMPORTANT: Please change your password after your first login!
                </p>
              </div>

              <p style="margin: 30px 0 20px 0; font-size: 16px; color: #333; line-height: 1.6;">
                <strong>Download the App:</strong>
              </p>

              <!-- App Download Buttons -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin: 20px 0;">
                <tr>
                  <td align="center">
                    <table cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding: 10px;">
                          <a href="https://apps.apple.com/app/dml-timeclock" style="display: inline-block; background-color: #000000; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold;">
                            📱 Download for iPhone
                          </a>
                        </td>
                        <td style="padding: 10px;">
                          <a href="https://play.google.com/store/apps/details?id=com.dml.timeclock" style="display: inline-block; background-color: #34A853; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold;">
                            📱 Download for Android
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <p style="margin: 20px 0; font-size: 14px; color: #666; text-align: center;">
                Or use the web version at: <a href="https://timeclock.dmlelectrical.com" style="color: #0b3ea8; text-decoration: none;">timeclock.dmlelectrical.com</a>
              </p>
              
              <p style="margin: 30px 0 20px 0; font-size: 16px; color: #333; line-height: 1.6;">
                <strong>To get started:</strong>
              </p>
              
              <ol style="margin: 0 0 20px 0; font-size: 16px; color: #333; line-height: 1.8; padding-left: 20px;">
                <li>Download the DML Time Clock app (links above)</li>
                <li>Open the app and tap "Sign In"</li>
                <li>Log in using the credentials above</li>
                <li>Complete your profile setup</li>
                <li>Change your temporary password</li>
                <li>Start clocking your hours!</li>
              </ol>

              <p style="margin: 20px 0; font-size: 16px; color: #333; line-height: 1.6;">
                If you have any questions or need assistance, please contact your supervisor.
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

    // Send email via Resend
    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'timeclock@dmlelectrical.com',
        to: [email],
        subject: 'Welcome to DML Electrical Time Clock - Your Account Details',
        html: html,
      }),
    })

    const emailData = await emailRes.json()

    if (!emailRes.ok) {
      console.error('Resend API Error:', emailData)
      // Don't throw error - account is created, just log the email issue
      console.warn('Account created but email failed to send')
      
      return new Response(
        JSON.stringify({ 
          success: true,
          message: 'Employee created successfully, but email failed to send',
          employee,
          user: authData.user,
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
        message: 'Employee created and welcome email sent successfully',
        employee,
        user: authData.user,
        tempPassword,
        emailSent: true,
        emailId: emailData.id
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error inviting employee:', error)
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Failed to invite employee',
        details: error.toString()
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})

/* To invoke locally:

  1. Run `supabase start` (see: https://supabase.com/docs/reference/cli/supabase-start)
  2. Make an HTTP request:

  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/invite-employee' \
    --header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0' \
    --header 'Content-Type: application/json' \
    --data '{"name":"Functions"}'

*/
