// Automated Weekly Timesheet Email Function
// Called by pg_cron every Monday at 8 AM
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

    // Create Supabase client with service role
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // Get the Monday of last week
    const getLastMonday = () => {
      const today = new Date();
      const dayOfWeek = today.getDay();
      const daysToSubtract = dayOfWeek === 0 ? 6 : dayOfWeek + 6; // Get last Monday
      const lastMonday = new Date(today);
      lastMonday.setDate(today.getDate() - daysToSubtract);
      return lastMonday.toISOString().split('T')[0];
    };

    const getWeekDays = (mondayStr) => {
      const days = [];
      const monday = new Date(mondayStr + 'T00:00:00');
      
      for (let i = 0; i < 7; i++) {
        const day = new Date(monday);
        day.setDate(monday.getDate() + i);
        days.push(day.toISOString().split('T')[0]);
      }
      
      return days;
    };

    const weekStart = getLastMonday();
    const weekDays = getWeekDays(weekStart);
    const weekEnd = weekDays[6];

    // Get all active employees
    const { data: employees, error: empError } = await supabase
      .from('employees')
      .select('id, user_id, first_name, last_name')
      .eq('is_active', true)
      .order('last_name', { ascending: true });

    if (empError) throw empError;

    // Get all shifts for last week
    const { data: shifts, error: shiftError } = await supabase
      .from('shifts')
      .select('*')
      .gte('clock_in', weekStart + 'T00:00:00')
      .lte('clock_in', weekEnd + 'T23:59:59');

    if (shiftError) throw shiftError;

    // Build timesheet data
    const timesheetData = [];
    for (const emp of employees || []) {
      const row = {
        employeeId: emp.id,
        employeeName: `${emp.first_name} ${emp.last_name}`,
        days: {},
        weekTotal: 0,
      };

      // Initialize all days to 0
      weekDays.forEach(day => {
        row.days[day] = 0;
      });

      // Calculate hours for each day
      const empShifts = (shifts || []).filter(s => s.user_id === emp.user_id);
      
      for (const shift of empShifts) {
        const clockInDate = shift.clock_in.split('T')[0];
        
        if (weekDays.includes(clockInDate)) {
          let hours = 0;
          
          if (shift.clock_out) {
            const start = new Date(shift.clock_in);
            const end = new Date(shift.clock_out);
            const diffMs = end - start;
            hours = diffMs / (1000 * 60 * 60);
          } else if (shift.total_hours) {
            hours = shift.total_hours;
          }
          
          row.days[clockInDate] += hours;
          row.weekTotal += hours;
        }
      }

      timesheetData.push(row);
    }

    // Calculate totals
    const dayTotals = weekDays.map(day => {
      return timesheetData.reduce((sum, row) => sum + row.days[day], 0);
    });
    const grandTotal = timesheetData.reduce((sum, row) => sum + row.weekTotal, 0);

    // Get all active recipients
    const { data: recipients, error: recipientsError } = await supabase
      .from('automated_timesheet_reports')
      .select('recipient_email')
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

    // Send email to each recipient
    const formatDate = (dateStr) => {
      const date = new Date(dateStr + 'T00:00:00');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const year = date.getFullYear();
      return `${month}/${day}/${year}`;
    };

    const formatDayHeader = (dateStr) => {
      const date = new Date(dateStr + 'T00:00:00');
      const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
      const monthDay = `${date.getMonth() + 1}/${date.getDate()}`;
      return `${dayName}<br/>${monthDay}`;
    };

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Weekly Timesheet Report</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 20px;">
    <tr>
      <td align="center">
        <table width="800" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          
          <!-- Header -->
          <tr>
            <td style="background-color: #0b3ea8; padding: 30px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0 0 10px 0; font-size: 32px;">Weekly Timesheet Report</h1>
              <p style="color: #ffffff; margin: 0; font-size: 16px;">${formatDate(weekStart)} to ${formatDate(weekEnd)}</p>
              <p style="color: #fcd34d; margin: 10px 0 0 0; font-size: 14px; font-style: italic;">Automated Weekly Report</p>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 40px 30px;">
              
              <!-- Timesheet Table -->
              <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse; margin-bottom: 20px;">
                <thead>
                  <tr style="background-color: #f3f4f6;">
                    <th style="padding: 12px; text-align: left; border: 1px solid #e5e7eb; font-weight: 700; color: #111; font-size: 12px;">Employee</th>
                    ${weekDays.map(day => `
                      <th style="padding: 12px; text-align: center; border: 1px solid #e5e7eb; font-weight: 700; color: #111; font-size: 11px;">
                        ${formatDayHeader(day)}
                      </th>
                    `).join('')}
                    <th style="padding: 12px; text-align: center; border: 1px solid #e5e7eb; font-weight: 700; background-color: #fef3c7; color: #111; font-size: 12px;">Week Total</th>
                  </tr>
                </thead>
                <tbody>
                  ${timesheetData.map((row, idx) => `
                    <tr style="background-color: ${idx % 2 === 0 ? '#fff' : '#f9fafb'};">
                      <td style="padding: 10px 12px; border: 1px solid #e5e7eb; font-weight: 600; color: #111; font-size: 12px;">${row.employeeName}</td>
                      ${weekDays.map(day => `
                        <td style="padding: 10px 12px; text-align: center; border: 1px solid #e5e7eb; color: #111; font-size: 12px;">
                          ${row.days[day] > 0 ? row.days[day].toFixed(2) : '—'}
                        </td>
                      `).join('')}
                      <td style="padding: 10px 12px; text-align: center; border: 1px solid #e5e7eb; font-weight: 700; background-color: #fef3c7; color: #111; font-size: 12px;">
                        ${row.weekTotal.toFixed(2)}
                      </td>
                    </tr>
                  `).join('')}
                  <tr style="background-color: #e5e7eb; font-weight: 700;">
                    <td style="padding: 12px; border: 1px solid #d1d5db; color: #111; font-size: 13px;">TOTALS</td>
                    ${dayTotals.map(total => `
                      <td style="padding: 12px; text-align: center; border: 1px solid #d1d5db; color: #111; font-size: 13px;">${total.toFixed(2)}</td>
                    `).join('')}
                    <td style="padding: 12px; text-align: center; border: 1px solid #d1d5db; background-color: #fcd34d; color: #111; font-size: 14px; font-weight: bold;">
                      ${grandTotal.toFixed(2)}
                    </td>
                  </tr>
                </tbody>
              </table>

              <p style="margin: 30px 0 10px 0; font-size: 14px; color: #666; text-align: center; line-height: 1.6;">
                This is your automated weekly timesheet report for ${formatDate(weekStart)} to ${formatDate(weekEnd)}.
              </p>

              <p style="margin: 20px 0 0 0; font-size: 14px; color: #333; text-align: center;">
                <strong>DML Electrical Service, LLC</strong>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 20px 30px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0; font-size: 11px; color: #666;">
                Generated automatically on ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}<br>
                DML Electrical Service, LLC<br>
                <em>To manage automated reports, log in to your account</em>
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
          to: [recipient.recipient_email],
          subject: `Weekly Timesheet Report - ${formatDate(weekStart)} to ${formatDate(weekEnd)}`,
          html: html,
        }),
      })
    );

    const results = await Promise.all(emailPromises);
    const successCount = results.filter(r => r.ok).length;

    return new Response(
      JSON.stringify({ 
        success: true,
        message: `Sent ${successCount} of ${recipients.length} automated reports`,
        weekStart,
        weekEnd,
        recipients: recipients.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error sending automated timesheet:', error)
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Failed to send automated timesheet',
        details: error.toString()
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
