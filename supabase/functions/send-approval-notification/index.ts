// Approval Notification Email Function
// Sends "Ready for Review" email to approver
import { corsHeaders } from '../_shared/cors.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const SITE_URL = Deno.env.get('SITE_URL') || 'http://localhost:5173'
    
    if (!RESEND_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Missing required environment variables')
    }

    const { week_start, week_end } = await req.json()

    // Create Supabase client
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // Get approver email
    const { data: settings } = await supabase
      .from('automated_timesheet_reports')
      .select('approver_email')
      .eq('requires_approval', true)
      .single()

    if (!settings?.approver_email) {
      throw new Error('No approver email configured')
    }

    // Get quick summary of the week's data
    const { data: employees } = await supabase
      .from('employees')
      .select('id')
      .eq('is_active', true)

    const { data: shifts } = await supabase
      .from('shifts')
      .select('*')
      .gte('clock_in', week_start + 'T00:00:00')
      .lte('clock_in', week_end + 'T23:59:59')

    // Calculate total hours
    let totalHours = 0
    for (const shift of shifts || []) {
      if (shift.clock_out) {
        const start = new Date(shift.clock_in)
        const end = new Date(shift.clock_out)
        const hours = (end - start) / (1000 * 60 * 60)
        totalHours += hours
      } else if (shift.total_hours) {
        totalHours += shift.total_hours
      }
    }

    const formatDate = (dateStr) => {
      const date = new Date(dateStr + 'T00:00:00')
      return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    }

    // Get pending report ID
    const { data: report } = await supabase
      .from('pending_timesheet_reports')
      .select('id')
      .eq('week_start', week_start)
      .eq('week_end', week_end)
      .single()

    const approvalUrl = `${SITE_URL}/reports/approve-timesheet?id=${report?.id}`

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Timesheet Ready for Review</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          
          <!-- Header -->
          <tr>
            <td style="background-color: #f59e0b; padding: 40px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0 0 10px 0; font-size: 32px;">⏰ Timesheet Ready for Review</h1>
              <p style="color: #ffffff; margin: 0; font-size: 18px; font-weight: 600;">Week of ${formatDate(week_start)} to ${formatDate(week_end)}</p>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 40px 30px;">
              
              <p style="font-size: 16px; color: #111; line-height: 1.6; margin: 0 0 20px 0;">
                The weekly timesheet report for last week is ready for your review.
              </p>

              <!-- Summary Box -->
              <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 20px; margin: 20px 0; border-radius: 4px;">
                <table width="100%">
                  <tr>
                    <td style="padding: 8px 0;">
                      <p style="margin: 0; font-size: 14px; color: #78350f; font-weight: 600;">Week Period:</p>
                      <p style="margin: 4px 0 0 0; font-size: 18px; color: #111; font-weight: bold;">${formatDate(week_start)} - ${formatDate(week_end)}</p>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0;">
                      <p style="margin: 0; font-size: 14px; color: #78350f; font-weight: 600;">Total Hours:</p>
                      <p style="margin: 4px 0 0 0; font-size: 24px; color: #111; font-weight: bold;">${totalHours.toFixed(1)} hours</p>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0;">
                      <p style="margin: 0; font-size: 14px; color: #78350f; font-weight: 600;">Active Employees:</p>
                      <p style="margin: 4px 0 0 0; font-size: 18px; color: #111; font-weight: bold;">${employees?.length || 0} employees</p>
                    </td>
                  </tr>
                </table>
              </div>

              <!-- Action Button -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin: 30px 0;">
                <tr>
                  <td align="center">
                    <a href="${approvalUrl}" style="display: inline-block; padding: 18px 40px; background-color: #10b981; color: #ffffff; text-decoration: none; border-radius: 8px; font-size: 18px; font-weight: bold; box-shadow: 0 4px 6px rgba(16, 185, 129, 0.3);">
                      ✅ Review & Approve Timesheet
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin: 20px 0 10px 0; font-size: 14px; color: #666; text-align: center; line-height: 1.6;">
                Click the button above to review the complete timesheet data.<br>
                You can approve and send, or make corrections before sending.
              </p>

              <div style="margin: 30px 0; padding: 20px; background-color: #f9fafb; border-radius: 4px;">
                <p style="margin: 0; font-size: 13px; color: #666; line-height: 1.6;">
                  <strong>What happens next?</strong><br>
                  • Review the timesheet for accuracy<br>
                  • Make any necessary corrections<br>
                  • Click "Approve & Send" to email reports to all recipients<br>
                  • Or click "Reject" if you need to make changes first
                </p>
              </div>

              <p style="margin: 20px 0 0 0; font-size: 14px; color: #333; text-align: center;">
                <strong>DML Electrical Service, LLC</strong>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 20px 30px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0; font-size: 11px; color: #666;">
                This is an automated notification from your timesheet system.<br>
                Generated on ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
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

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'reports@dmlelectrical.com',
        to: [settings.approver_email],
        subject: `⏰ Weekly Timesheet Ready for Review - ${formatDate(week_start)}`,
        html: html,
      }),
    })

    const data = await res.json()

    if (!res.ok) {
      throw new Error(data.message || 'Failed to send email')
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Approval notification sent',
        emailId: data.id,
        totalHours,
        employees: employees?.length || 0
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error sending approval notification:', error)
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Failed to send notification',
        details: error.toString()
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
