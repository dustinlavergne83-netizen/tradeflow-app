import { corsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
    if (!RESEND_API_KEY) throw new Error('RESEND_API_KEY is not set')

    const {
      to,
      customerName,
      projectName,
      estimateNumber,
      estimateDate,
      lineItems,
      total,
      notes,
      message,
      estimateId,
      siteUrl,
      viewFormat,
      companyName = "DML Electrical Service, LLC"
    } = await req.json()

    if (!to) {
      return new Response(
        JSON.stringify({ error: 'Recipient email is required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    const formatDate = (dateStr: string) => {
      if (!dateStr) return 'N/A'
      return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
        year: 'numeric', month: 'long', day: 'numeric'
      })
    }

    const fmtMoney = (amount: number) =>
      (amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

    // View link — goes directly to chosen format
    const baseUrl = siteUrl || Deno.env.get('SITE_URL') || 'http://localhost:5173'
    const chosenView = viewFormat || 'summary'
    const viewLink = `${baseUrl}/estimate/quick/view?estimateId=${estimateId}&view=${chosenView}`

    // ── Scope bullets (only for summary view, only show_in_scope items) ──
    const scopeItems: any[] = (lineItems || []).filter((i: any) => i.show_in_scope !== false)

    let scopeSection = ''
    if (chosenView === 'summary' && scopeItems.length > 0) {
      const bullets = scopeItems.map((item: any) =>
        `<li style="padding: 5px 0; font-size: 14px; color: #222; line-height: 1.6;">
          <span style="color: #fc6b04; font-weight: bold; margin-right: 6px;">•</span>${item.description || ''}
        </li>`
      ).join('')
      scopeSection = `
        <div style="margin: 20px 0;">
          <div style="border-top: 2px solid #fc6b04; border-bottom: 2px solid #fc6b04; padding: 8px 0; margin-bottom: 12px;">
            <span style="font-size: 11px; font-weight: bold; color: #444; text-transform: uppercase; letter-spacing: 1px;">
              Scope of Work
            </span>
          </div>
          ${notes ? `<p style="font-size: 13px; color: #444; margin: 0 0 10px; line-height: 1.6; white-space: pre-wrap;">${notes}</p>` : ''}
          <ul style="margin: 0; padding: 0; list-style: none;">
            ${bullets}
          </ul>
        </div>`
    } else if (chosenView !== 'summary') {
      // Itemized — just a brief note, full details are behind the button
      const viewLabel = chosenView === 'itemized' ? 'Itemized with Pricing' : 'Itemized (No Individual Prices)'
      scopeSection = `
        <div style="margin: 20px 0; padding: 14px 16px; background: #f9fafb; border-left: 4px solid #fc6b04; border-radius: 4px;">
          <p style="margin: 0; font-size: 14px; color: #444; line-height: 1.6;">
            The full itemized estimate (<strong>${viewLabel}</strong>) is available via the button below.
          </p>
        </div>`
    } else if (notes) {
      scopeSection = `
        <div style="margin: 20px 0; padding: 14px 16px; background: #f9fafb; border-left: 4px solid #fc6b04; border-radius: 4px;">
          <p style="margin: 0; font-size: 14px; color: #444; line-height: 1.6; white-space: pre-wrap;">${notes}</p>
        </div>`
    }

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Estimate #${estimateNumber}</title>
</head>
<body style="margin:0;padding:0;font-family:Arial,sans-serif;background:#f5f5f5;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:20px;">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.12);">

      <!-- Header -->
      <tr>
        <td style="background:#0b3ea8;padding:28px 30px;text-align:center;">
          <h1 style="color:#f97316;margin:0;font-size:26px;letter-spacing:2px;">ESTIMATE</h1>
          <p style="color:#fff;margin:8px 0 0;font-size:13px;">${companyName}</p>
        </td>
      </tr>

      <!-- Body -->
      <tr>
        <td style="padding:32px 30px;">

          <!-- Greeting -->
          <p style="margin:0 0 16px;font-size:16px;color:#333;">
            Dear ${customerName || 'Valued Customer'},
          </p>

          ${message ? `
          <p style="margin:0 0 20px;font-size:15px;color:#333;line-height:1.6;">${message}</p>
          ` : `
          <p style="margin:0 0 20px;font-size:15px;color:#333;line-height:1.6;">
            Thank you for the opportunity to provide an estimate${projectName && projectName !== 'Quick Estimate' ? ` for <strong>"${projectName}"</strong>` : ''}.
            Please review the details below.
          </p>
          `}

          <!-- Estimate Summary Box -->
          <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;margin:0 0 20px;">
            <tr style="background:#f9fafb;">
              <td colspan="2" style="padding:12px 16px;border-bottom:2px solid #e5e7eb;">
                <span style="font-size:13px;font-weight:bold;color:#0b3ea8;text-transform:uppercase;letter-spacing:1px;">
                  Estimate Summary
                </span>
              </td>
            </tr>
            <tr>
              <td style="padding:12px 16px;border-bottom:1px solid #f0f0f0;color:#666;font-size:14px;width:40%;">Estimate #</td>
              <td style="padding:12px 16px;border-bottom:1px solid #f0f0f0;color:#111;font-size:14px;font-weight:600;text-align:right;">${estimateNumber}</td>
            </tr>
            <tr>
              <td style="padding:12px 16px;border-bottom:1px solid #f0f0f0;color:#666;font-size:14px;">Date</td>
              <td style="padding:12px 16px;border-bottom:1px solid #f0f0f0;color:#111;font-size:14px;font-weight:600;text-align:right;">${formatDate(estimateDate)}</td>
            </tr>
            ${projectName && projectName !== 'Quick Estimate' ? `
            <tr>
              <td style="padding:12px 16px;border-bottom:1px solid #f0f0f0;color:#666;font-size:14px;">Project</td>
              <td style="padding:12px 16px;border-bottom:1px solid #f0f0f0;color:#111;font-size:14px;font-weight:600;text-align:right;">${projectName}</td>
            </tr>
            ` : ''}
            <tr style="background:#fff7ed;">
              <td style="padding:14px 16px;color:#ea580c;font-size:15px;font-weight:bold;">Total Investment</td>
              <td style="padding:14px 16px;color:#fc6b04;font-size:22px;font-weight:800;text-align:right;">$${fmtMoney(total)}</td>
            </tr>
          </table>

          <!-- Scope / Items section -->
          ${scopeSection}

          <!-- CTA Button -->
          <table width="100%" cellpadding="0" cellspacing="0" style="margin:28px 0 16px;">
            <tr>
              <td align="center">
                <a href="${viewLink}"
                   style="display:inline-block;padding:16px 44px;background:#fc6b04;color:#fff;text-decoration:none;border-radius:8px;font-size:17px;font-weight:bold;box-shadow:0 2px 6px rgba(252,107,4,0.35);">
                  📄 View &amp; Print Estimate
                </a>
              </td>
            </tr>
          </table>

          <p style="margin:0 0 20px;font-size:13px;color:#888;text-align:center;line-height:1.5;">
            Click the button above to view the complete estimate and print a copy for your records.<br>
            This estimate is valid for 30 days. Contact us if you have any questions.
          </p>

          <p style="margin:20px 0 0;font-size:15px;color:#333;text-align:center;">
            Thank you for the opportunity!<br>
            <strong>${companyName}</strong>
          </p>
        </td>
      </tr>

      <!-- Footer -->
      <tr>
        <td style="background:#f9fafb;padding:18px 30px;text-align:center;border-top:1px solid #e5e7eb;">
          <p style="margin:0;font-size:12px;color:#888;">
            ${companyName}<br>
            Phone: (337)288-0395 &nbsp;·&nbsp; Email: info@dmlelectrical.com
          </p>
        </td>
      </tr>
    </table>
  </td></tr>
</table>
</body>
</html>`

    const emailAddresses = to.split(/[,;]/).map((e: string) => e.trim()).filter((e: string) => e.length > 0)

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'DML Electrical Service <noreply@dmlelectrical.com>',
        reply_to: 'dustin@dmlelectrical.com',
        to: emailAddresses,
        bcc: ['dustin@dmlelectrical.com'],
        subject: `Estimate #${estimateNumber}${projectName && projectName !== 'Quick Estimate' ? ` – ${projectName}` : ''} — $${fmtMoney(total)}`,
        html,
      }),
    })

    const data = await res.json()
    if (!res.ok) {
      console.error('Resend API Error:', data)
      throw new Error(data.message || 'Failed to send email')
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Estimate sent successfully', emailId: data.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error sending estimate:', error)
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to send estimate', details: error.toString() }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
