// Individual Weekly Timesheet Email Function with PDF Attachment
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
      pdfBase64,
      companyName = "DML Electrical Service, LLC"
    } = await req.json()

    if (!to) {
      return new Response(
        JSON.stringify({ error: 'Recipient email is required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    if (!pdfBase64) {
      return new Response(
        JSON.stringify({ error: 'PDF data is required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    const formatDate = (dateStr: string) => {
      const date = new Date(dateStr + 'T00:00:00');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const year = date.getFullYear();
      return `${month}/${day}/${year}`;
    };

    const employeeNames = timesheetData.map((emp: any) => emp.name).join(', ');

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
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          
          <!-- Header -->
          <tr>
            <td style="background-color: #0b3ea8; padding: 30px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0 0 10px 0; font-size: 28px;">Weekly Timesheet Report</h1>
              <p style="color: #ffffff; margin: 0; font-size: 16px;">${formatDate(weekStart)} to ${formatDate(weekEnd)}</p>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 40px 30px;">
              <p style="margin: 0 0 20px 0; font-size: 16px; color: #333; line-height: 1.6;">
                Hello,
              </p>
              
              <p style="margin: 0 0 20px 0; font-size: 16px; color: #333; line-height: 1.6;">
                Please find attached the Weekly Timesheet Report for the week of <strong>${formatDate(weekStart)}</strong> to <strong>${formatDate(weekEnd)}</strong>.
              </p>

              <div style="background-color: #f3f4f6; border-left: 4px solid #fc6b04; padding: 15px 20px; margin: 20px 0;">
                <p style="margin: 0 0 8px 0; font-size: 14px; color: #666; font-weight: 600;">Week Summary:</p>
                <p style="margin: 0; font-size: 14px; color: #333;">
                  <strong>Employees:</strong> ${employeeNames}
                </p>
              </div>

              <p style="margin: 20px 0 0 0; font-size: 14px; color: #666; line-height: 1.6;">
                The PDF attachment contains the complete timesheet with all hours worked for each day of the week.
              </p>

              <p style="margin: 30px 0 0 0; font-size: 14px; color: #333;">
                Best regards,<br>
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
        attachments: [
          {
            filename: `Weekly_Timesheet_${weekStart}.pdf`,
            content: pdfBase64,
          }
        ]
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
