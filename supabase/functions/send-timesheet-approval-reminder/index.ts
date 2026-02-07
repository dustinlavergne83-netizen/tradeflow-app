// Monday Timesheet Approval Reminder Function
// Sends notification to review and approve last week's timesheet
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
    
    if (!RESEND_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Missing required environment variables')
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // Get the Monday of last week
    const getLastMonday = () => {
      const today = new Date();
      const dayOfWeek = today.getDay();
      const daysToSubtract = dayOfWeek === 0 ? 6 : dayOfWeek + 6;
      const lastMonday = new Date(today);
      lastMonday.setDate(today.getDate() - daysToSubtract);
      return lastMonday.toISOString().split('T')[0];
    };

    const getLastSunday = () => {
      const lastMonday = new Date(getLastMonday());
      const lastSunday = new Date(lastMonday);
      lastSunday.setDate(lastMonday.getDate() + 6);
      return lastSunday.toISOString().split('T')[0];
    };

    const weekStart = getLastMonday();
    const weekEnd = getLastSunday();

    // Check if approval already exists
    const { data: existingApproval, error: approvalError } = await supabase
      .from('timesheet_approvals')
      .select('*')
      .eq('week_start', weekStart)
      .eq('week_end', weekEnd)
      .single();

    if (approvalError && approvalError.code !== 'PGRST116') {
      throw approvalError;
    }

    // If already approved, don't send reminder
    if (existingApproval && existingApproval.status === 'approved') {
      return new Response(
        JSON.stringify({ 
          success: true,
          message: 'Timesheet already approved',
          weekStart,
          weekEnd,
          status: existingApproval.status
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create pending approval record if it doesn't exist
    if (!existingApproval) {
      await supabase
        .from('timesheet_approvals')
        .insert({
          week_start: weekStart,
          week_end: weekEnd,
          status: 'pending'
        });
    }

    // Get approval link (you'll need to update this with your actual URL)
    const appUrl = SUPABASE_URL.replace('.supabase.co', '.vercel.app') || 'http://localhost:5174';
    const approvalLink = `${appUrl}/reports/weekly-timesheet?week=${weekStart}&approve=true`;

    const formatDate = (dateStr: string) => {
      const date = new Date(dateStr + 'T00:00:00');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const year = date.getFullYear();
      return `${month}/${day}/${year}`;
    };

    // Get recipients
    const { data: recipients, error: recipientsError } = await supabase
      .from('timesheet_approval_recipients')
      .select('email, name')
      .eq('is_active', true);

    if (recipientsError) throw recipientsError;

    if (!recipients || recipients.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true,
          message: 'No active recipients configured',
          weekStart,
          weekEnd
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Timesheet Approval Reminder</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          
          <!-- Header -->
          <tr>
            <td style="background-color: #0b3ea8; padding: 30px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0 0 10px 0; font-size: 28px;">⏰ Timesheet Approval Reminder</h1>
              <p style="color: #fcd34d; margin: 0; font-size: 16px;">Week of ${formatDate(weekStart)} to ${formatDate(weekEnd)}</p>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 40px 30px;">
              <p style="margin: 0 0 20px 0; font-size: 16px; color: #333; line-height: 1.6;">
                Hello,
              </p>
              
              <p style="margin: 0 0 20px 0; font-size: 16px; color: #333; line-height: 1.6;">
                This is a reminder to review and approve the weekly timesheet for <strong>${formatDate(weekStart)}</strong> to <strong>${formatDate(weekEnd)}</strong>.
              </p>

              <div style="background-color: #fef3c7; border-left: 4px solid #fc6b04; padding: 15px 20px; margin: 20px 0;">
                <p style="margin: 0 0 8px 0; font-size: 14px; color: #92400e; font-weight: 600;">Action Required:</p>
                <p style="margin: 0; font-size: 14px; color: #92400e;">
                  Please review the timesheet and approve it. Once approved, the report will be automatically sent to all configured recipients.
                </p>
              </div>

              <div style="text-align: center; margin: 30px 0;">
                <a href="${approvalLink}" style="background-color: #fc6b04; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 16px; font-weight: 600; display: inline-block;">
                  Review & Approve Timesheet →
                </a>
              </div>

              <p style="margin: 30px 0 0 0; font-size: 14px; color: #666; line-height: 1.6;">
                If you're unable to click the button above, copy and paste this link into your browser:<br>
                <a href="${approvalLink}" style="color: #0b3ea8; word-break: break-all;">${approvalLink}</a>
              </p>

              <p style="margin: 30px 0 0 0; font-size: 14px; color: #333;">
                Best regards,<br>
                <strong>DML Electrical Service, LLC</strong>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 20px 30px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0; font-size: 11px; color: #666;">
                Sent on ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', weekday: 'long' })}<br>
                DML Electrical Service, LLC<br>
                <em>Automated Timesheet Approval System</em>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `;

    const emailPromises = recipients.map(recipient =>
      fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: 'reports@dmlelectrical.com',
          to: [recipient.email],
          subject: `⏰ Timesheet Approval Reminder - ${formatDate(weekStart)} to ${formatDate(weekEnd)}`,
          html: html,
        }),
      })
    );

    const results = await Promise.all(emailPromises);
    const successCount = results.filter(r => r.ok).length;

    return new Response(
      JSON.stringify({ 
        success: true,
        message: `Sent ${successCount} of ${recipients.length} reminder emails`,
        weekStart,
        weekEnd,
        recipients: recipients.length,
        approvalStatus: existingApproval?.status || 'pending'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error sending approval reminder:', error)
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Failed to send approval reminder',
        details: error.toString()
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
