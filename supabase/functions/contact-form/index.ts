import { corsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
    if (!RESEND_API_KEY) throw new Error('RESEND_API_KEY is not set')

    const { firstName, lastName, email, phone, service, message } = await req.json()

    if (!firstName || !email) {
      return new Response(
        JSON.stringify({ error: 'Name and email are required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;font-family:Arial,sans-serif;background:#f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:20px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 4px rgba(0,0,0,0.1);">
        
        <!-- Header -->
        <tr>
          <td style="background:#0b3ea8;padding:24px 30px;text-align:center;">
            <h1 style="color:#fc6b04;margin:0 0 6px 0;font-size:26px;font-style:italic;">DML Electrical Service</h1>
            <p style="color:#ffffff;margin:0;font-size:14px;">📬 New Website Contact Form Submission</p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:30px;">
            
            <div style="background:#f0f4ff;border-left:4px solid #0b3ea8;border-radius:4px;padding:16px;margin-bottom:24px;">
              <p style="margin:0;font-size:16px;color:#0b3ea8;font-weight:bold;">New estimate request from your website!</p>
            </div>

            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
              <tr style="background:#f9fafb;">
                <td colspan="2" style="padding:10px 16px;font-size:12px;font-weight:bold;color:#666;text-transform:uppercase;letter-spacing:0.5px;">Contact Details</td>
              </tr>
              <tr>
                <td style="padding:12px 16px;font-size:14px;color:#666;width:140px;border-top:1px solid #e5e7eb;">Name:</td>
                <td style="padding:12px 16px;font-size:15px;color:#111;font-weight:600;border-top:1px solid #e5e7eb;">${firstName} ${lastName || ''}</td>
              </tr>
              <tr style="background:#f9fafb;">
                <td style="padding:12px 16px;font-size:14px;color:#666;border-top:1px solid #e5e7eb;">Email:</td>
                <td style="padding:12px 16px;font-size:15px;color:#0b3ea8;border-top:1px solid #e5e7eb;"><a href="mailto:${email}" style="color:#0b3ea8;">${email}</a></td>
              </tr>
              <tr>
                <td style="padding:12px 16px;font-size:14px;color:#666;border-top:1px solid #e5e7eb;">Phone:</td>
                <td style="padding:12px 16px;font-size:15px;color:#111;font-weight:600;border-top:1px solid #e5e7eb;"><a href="tel:${phone}" style="color:#111;">${phone || 'Not provided'}</a></td>
              </tr>
              <tr style="background:#f9fafb;">
                <td style="padding:12px 16px;font-size:14px;color:#666;border-top:1px solid #e5e7eb;">Service:</td>
                <td style="padding:12px 16px;font-size:15px;color:#111;font-weight:600;border-top:1px solid #e5e7eb;">${service || 'Not specified'}</td>
              </tr>
            </table>

            <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
              <tr style="background:#f9fafb;">
                <td style="padding:10px 16px;font-size:12px;font-weight:bold;color:#666;text-transform:uppercase;letter-spacing:0.5px;">Message / Project Description</td>
              </tr>
              <tr>
                <td style="padding:16px;font-size:15px;color:#333;line-height:1.7;border-top:1px solid #e5e7eb;">${message || 'No message provided'}</td>
              </tr>
            </table>

            <div style="margin-top:24px;padding:16px;background:#fff9f0;border-radius:8px;border:1px solid #fde68a;text-align:center;">
              <p style="margin:0;font-size:14px;color:#92400e;">💡 Reply directly to this email to respond to <strong>${firstName}</strong>, or call <a href="tel:${phone}" style="color:#92400e;">${phone}</a></p>
            </div>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f9fafb;padding:16px 30px;text-align:center;border-top:1px solid #e5e7eb;">
            <p style="margin:0;font-size:12px;color:#999;">Sent from the contact form at dmlelectrical.com</p>
          </td>
        </tr>
      </table>
    </td></tr>
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
        from: 'website@dmlelectrical.com',
        to: ['dustin@dmlelectrical.com'],
        reply_to: email,
        subject: `🔌 New Estimate Request: ${firstName} ${lastName || ''} — ${service || 'General Inquiry'}`,
        html,
      }),
    })

    const data = await res.json()
    if (!res.ok) throw new Error(data.message || 'Failed to send email')

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Contact form error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
