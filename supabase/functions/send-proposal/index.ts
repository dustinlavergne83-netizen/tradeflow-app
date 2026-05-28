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

    const { 
      to, 
      contractorName,
      projectName,
      estimateNumber,
      baseBidAmount,
      alternates,
      totalAmount,
      proposalId,
      companyName = "DML Electrical Service, LLC"
    } = await req.json()

    if (!to) {
      return new Response(
        JSON.stringify({ error: 'Recipient email is required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    const fmtMoney = (val: number) =>
      (val || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

    // Generate view link
    const viewLink = proposalId ? 
      `${Deno.env.get('SITE_URL') || 'http://localhost:5173'}/proposal/view?proposalId=${proposalId}` :
      null;

    // Generate simplified HTML email with view link
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Project Proposal - ${estimateNumber}</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          
          <!-- Header -->
          <tr>
            <td style="background-color: #0b3ea8; padding: 30px; text-align: center;">
              <h1 style="color: #f97316; margin: 0; font-size: 28px;">PROJECT PROPOSAL</h1>
              <p style="color: #ffffff; margin: 10px 0 0 0; font-size: 14px;">${companyName}</p>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 40px 30px;">
              <p style="margin: 0 0 20px 0; font-size: 16px; color: #333;">
                Dear ${contractorName || 'Valued Customer'},
              </p>
              
              <p style="margin: 0 0 20px 0; font-size: 16px; color: #333; line-height: 1.6;">
                Thank you for the opportunity to provide a proposal for${projectName ? ` <strong>"${projectName}"</strong>` : ' your electrical project'}. Please find the proposal summary below.
              </p>

              <!-- Proposal Summary -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin: 20px 0; border: 1px solid #e5e7eb; border-radius: 6px; overflow: hidden;">
                <tr style="background-color: #f9fafb;">
                  <td colspan="2" style="padding: 15px; border-bottom: 2px solid #e5e7eb;">
                    <h3 style="margin: 0; color: #0b3ea8; font-size: 18px;">PROPOSAL SUMMARY</h3>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 15px; border-bottom: 1px solid #e5e7eb; color: #666;">
                    <strong>Estimate #:</strong>
                  </td>
                  <td style="padding: 15px; border-bottom: 1px solid #e5e7eb; text-align: right; color: #111;">
                    ${estimateNumber}
                  </td>
                </tr>
                ${projectName ? `
                <tr>
                  <td style="padding: 15px; border-bottom: 1px solid #e5e7eb; color: #666;">
                    <strong>Project:</strong>
                  </td>
                  <td style="padding: 15px; border-bottom: 1px solid #e5e7eb; text-align: right; color: #111;">
                    ${projectName}
                  </td>
                </tr>
                ` : ''}
                <tr>
                  <td style="padding: 15px; border-bottom: 1px solid #e5e7eb; color: #666;">
                    <strong>Base Bid:</strong>
                  </td>
                  <td style="padding: 15px; border-bottom: 1px solid #e5e7eb; text-align: right; color: #111; font-weight: 600;">
                    $${fmtMoney(baseBidAmount)}
                  </td>
                </tr>
                ${alternates && alternates.length > 0 ? alternates.slice(0, 3).map((alt: any) => `
                <tr>
                  <td style="padding: 15px; border-bottom: 1px solid #e5e7eb; color: #666;">
                    <strong>Alt ${alt.number}:</strong> ${alt.title}
                  </td>
                  <td style="padding: 15px; border-bottom: 1px solid #e5e7eb; text-align: right; color: #111; font-weight: 600;">
                    $${fmtMoney(alt.amount)}
                  </td>
                </tr>
                `).join('') : ''}
                ${alternates && alternates.length > 3 ? `
                <tr>
                  <td colspan="2" style="padding: 15px; border-bottom: 1px solid #e5e7eb; color: #666; text-align: center; font-style: italic;">
                    + ${alternates.length - 3} more alternate${alternates.length - 3 > 1 ? 's' : ''}
                  </td>
                </tr>
                ` : ''}
                <tr style="background-color: #f9fafb;">
                  <td style="padding: 15px; color: #111;">
                    <strong style="font-size: 18px;">TOTAL INVESTMENT:</strong>
                  </td>
                  <td style="padding: 15px; text-align: right; color: #fc6b04ff; font-weight: bold; font-size: 22px;">
                    $${fmtMoney(totalAmount)}
                  </td>
                </tr>
              </table>

              ${viewLink ? `
              <!-- View & Print Button -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin: 30px 0;">
                <tr>
                  <td align="center">
                    <a href="${viewLink}" style="display: inline-block; padding: 16px 40px; background-color: #fc6b04; color: #ffffff; text-decoration: none; border-radius: 8px; font-size: 18px; font-weight: bold; box-shadow: 0 2px 4px rgba(252, 107, 4, 0.3);">
                      📄 View &amp; Print Proposal
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin: 20px 0 10px 0; font-size: 14px; color: #666; text-align: center; line-height: 1.6;">
                Click the button above to view the complete proposal details and print a copy for your records.
              </p>
              ` : ''}

              <p style="margin: 20px 0; font-size: 14px; color: #666; line-height: 1.6; text-align: center;">
                This proposal is valid for 30 days. If you have questions, please contact us.
              </p>

              <p style="margin: 20px 0 0 0; font-size: 16px; color: #333; text-align: center;">
                <strong>${companyName}</strong>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 20px 30px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0; font-size: 12px; color: #666;">
                ${companyName}<br>
                Phone: (337)288-0395 &bull; Email: info@dmlelectrical.com
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

    // Handle multiple email addresses (comma or semicolon separated)
    const emailAddresses = to.split(/[,;]/).map((email: string) => email.trim()).filter((email: string) => email.length > 0);
    
    // Send email via Resend
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'DML Electrical Service <noreply@tradeflowllc.com>',
        reply_to: 'dustin@dmlelectrical.com',
        to: emailAddresses,
        bcc: ['dustin@dmlelectrical.com'],
        subject: `Project Proposal #${estimateNumber}${projectName ? ` - ${projectName}` : ''}`,
        html: html,
        tags: [{ name: 'category', value: 'proposal' }],
        headers: {
          'X-Entity-Ref-ID': `proposal-${proposalId || estimateNumber}`,
        },
      }),
    })

    const data = await res.json()

    if (!res.ok) {
      console.error('Resend API Error Status:', res.status)
      console.error('Resend API Error Body:', JSON.stringify(data))
      const resendMsg = data.message || data.name || data.error || JSON.stringify(data)
      if (res.status === 403 || (resendMsg && resendMsg.toLowerCase().includes('domain') && resendMsg.toLowerCase().includes('not verified'))) {
        throw new Error(
          `Email domain not verified.\n\n` +
          `To fix:\n` +
          `1. Log into resend.com\n` +
          `2. Go to "Domains" → "Add Domain"\n` +
          `3. Enter: dmlelectrical.com\n` +
          `4. Add the DNS records to your domain registrar\n` +
          `5. Click "Verify" in Resend\n\n` +
          `Resend error: ${resendMsg}`
        )
      }
      throw new Error(`Resend API error (${res.status}): ${resendMsg}`)
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Proposal sent successfully',
        emailId: data.id 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error sending proposal:', error)
    // Return 200 so Supabase client can read the actual error message
    // (non-2xx causes a generic FunctionsHttpError that hides the real details)
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message || 'Failed to send proposal',
        details: error.toString()
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  }
})
