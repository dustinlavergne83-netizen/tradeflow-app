// Weekly Timesheet Email Function
import { corsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
    
    if (!RESEND_API_KEY) {
      throw new Error('RESEND_API_KEY is not set')
    }

    const { 
      to, 
      weekStart,
      weekEnd,
      timesheetData,
      dayTotals,
      grandTotal,
      companyName = "DML Electrical Service, LLC",
      logoUrl
    } = await req.json()

    if (!to) {
      return new Response(
        JSON.stringify({ error: 'Recipient email is required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    if (!timesheetData || !weekStart || !weekEnd) {
      return new Response(
        JSON.stringify({ error: 'Timesheet data and dates are required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

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

    // Get week days
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

    const weekDays = getWeekDays(weekStart);

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
              ${logoUrl ? `<img src="${logoUrl}" alt="Company Logo" style="max-width: 200px; height: auto; margin-bottom: 20px;" />` : ''}
              <h1 style="color: #ffffff; margin: 0 0 10px 0; font-size: 32px;">Weekly Timesheet Report</h1>
              <p style="color: #ffffff; margin: 0; font-size: 16px;">${formatDate(weekStart)} to ${formatDate(weekEnd)}</p>
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
                This report shows all employee hours for the week of ${formatDate(weekStart)} to ${formatDate(weekEnd)}.
              </p>

              <p style="margin: 20px 0 0 0; font-size: 14px; color: #333; text-align: center;">
                <strong>${companyName}</strong>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 20px 30px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0; font-size: 11px; color: #666;">
                Generated on ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}<br>
                ${companyName}
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
        to: [to],
        subject: `Weekly Timesheet Report - ${formatDate(weekStart)} to ${formatDate(weekEnd)}`,
        html: html,
      }),
    })

    const data = await res.json()

    if (!res.ok) {
      console.error('Resend API Error:', data)
      throw new Error(data.message || 'Failed to send email')
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Timesheet report sent successfully',
        emailId: data.id 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error sending timesheet:', error)
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Failed to send timesheet',
        details: error.toString()
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
