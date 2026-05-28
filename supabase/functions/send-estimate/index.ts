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
      companyName = "DML Electrical Service, LLC"
    } = await req.json()

    if (!to) {
      return new Response(
        JSON.stringify({ error: 'Recipient email is required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    const formatDate = (dateStr: string) => {
      if (!dateStr) return 'N/A';
      return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
    };

    const fmtMoney = (amount: number) => {
      return (amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

    // Generate view link
    const baseUrl = siteUrl || Deno.env.get('SITE_URL') || 'http://localhost:5173';
    const viewLink = `${baseUrl}/estimate/quick/view?estimateId=${estimateId}`;

    // Build line items HTML
    let lineItemsHtml = '';
    if (lineItems && lineItems.length > 0) {
      const hasLabor = lineItems.some((item: any) => (item.labor_total || 0) > 0);
      
      if (hasLabor) {
        lineItemsHtml = `
          <tr style="background-color: #0b3ea8;">
            <td style="padding: 10px 8px; font-size: 12px; color: #fff; font-weight: bold; text-transform: uppercase;">Description</td>
            <td style="padding: 10px 8px; font-size: 12px; color: #fff; font-weight: bold; text-transform: uppercase; text-align: center;">Qty</td>
            <td style="padding: 10px 8px; font-size: 12px; color: #fff; font-weight: bold; text-transform: uppercase; text-align: right;">Material</td>
            <td style="padding: 10px 8px; font-size: 12px; color: #fff; font-weight: bold; text-transform: uppercase; text-align: right;">Labor</td>
            <td style="padding: 10px 8px; font-size: 12px; color: #fff; font-weight: bold; text-transform: uppercase; text-align: right;">Total</td>
          </tr>`;
        lineItems.forEach((item: any) => {
          lineItemsHtml += `
            <tr>
              <td style="padding: 12px 8px; border-bottom: 1px solid #e5e7eb; font-size: 14px; color: #111; font-weight: 600;">${item.description || ''}</td>
              <td style="padding: 12px 8px; border-bottom: 1px solid #e5e7eb; font-size: 14px; color: #666; text-align: center;">${item.quantity || 1}</td>
              <td style="padding: 12px 8px; border-bottom: 1px solid #e5e7eb; font-size: 14px; color: #666; text-align: right;">$${fmtMoney(item.material_total)}</td>
              <td style="padding: 12px 8px; border-bottom: 1px solid #e5e7eb; font-size: 14px; color: #666; text-align: right;">$${fmtMoney(item.labor_total)}</td>
              <td style="padding: 12px 8px; border-bottom: 1px solid #e5e7eb; font-size: 14px; color: #111; text-align: right; font-weight: 600;">$${fmtMoney(item.line_total)}</td>
            </tr>`;
        });
      } else {
        lineItemsHtml = `
          <tr style="background-color: #0b3ea8;">
            <td style="padding: 10px 8px; font-size: 12px; color: #fff; font-weight: bold; text-transform: uppercase;">Description</td>
            <td style="padding: 10px 8px; font-size: 12px; color: #fff; font-weight: bold; text-transform: uppercase; text-align: right;">Amount</td>
          </tr>`;
        lineItems.forEach((item: any) => {
          lineItemsHtml += `
            <tr>
              <td style="padding: 12px 8px; border-bottom: 1px solid #e5e7eb; font-size: 14px; color: #111; font-weight: 600;">${item.description || ''}</td>
              <td style="padding: 12px 8px; border-bottom: 1px solid #e5e7eb; font-size: 14px; color: #111; text-align: right; font-weight: 600;">$${fmtMoney(item.line_total || item.material_total)}</td>
            </tr>`;
        });
      }
    }

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Estimate #${estimateNumber}</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          
          <!-- Header -->
          <tr>
            <td style="background-color: #0b3ea8; padding: 30px; text-align: center;">
              <h1 style="color: #f97316; margin: 0; font-size: 28px;">ESTIMATE</h1>
              <p style="color: #ffffff; margin: 10px 0 0 0; font-size: 14px;">${companyName}</p>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 40px 30px;">
              <p style="margin: 0 0 20px 0; font-size: 16px; color: #333;">
                Dear ${customerName || 'Valued Customer'},
              </p>
              
              ${message ? `
              <p style="margin: 0 0 20px 0; font-size: 16px; color: #333; line-height: 1.6;">
                ${message}
              </p>
              ` : `
              <p style="margin: 0 0 20px 0; font-size: 16px; color: #333; line-height: 1.6;">
                Thank you for the opportunity to provide an estimate for${projectName && projectName !== 'Quick Estimate' ? ` <strong>"${projectName}"</strong>` : ' your project'}. Please find the estimate details below.
              </p>
              `}

              <!-- Estimate Summary -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin: 20px 0; border: 1px solid #e5e7eb; border-radius: 6px; overflow: hidden;">
                <tr style="background-color: #f9fafb;">
                  <td colspan="2" style="padding: 15px; border-bottom: 2px solid #e5e7eb;">
                    <h3 style="margin: 0; color: #0b3ea8; font-size: 18px;">ESTIMATE SUMMARY</h3>
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
                <tr>
                  <td style="padding: 15px; border-bottom: 1px solid #e5e7eb; color: #666;">
                    <strong>Date:</strong>
                  </td>
                  <td style="padding: 15px; border-bottom: 1px solid #e5e7eb; text-align: right; color: #111;">
                    ${formatDate(estimateDate)}
                  </td>
                </tr>
                ${projectName && projectName !== 'Quick Estimate' ? `
                <tr>
                  <td style="padding: 15px; border-bottom: 1px solid #e5e7eb; color: #666;">
                    <strong>Project:</strong>
                  </td>
                  <td style="padding: 15px; border-bottom: 1px solid #e5e7eb; text-align: right; color: #111;">
                    ${projectName}
                  </td>
                </tr>
                ` : ''}
              </table>

              <!-- Line Items -->
              ${lineItemsHtml ? `
              <table width="100%" cellpadding="0" cellspacing="0" style="margin: 20px 0; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
                ${lineItemsHtml}
              </table>
              ` : ''}

              <!-- Total -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin: 20px 0;">
                <tr>
                  <td width="50%"></td>
                  <td width="50%">
                    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9fafb; border-radius: 8px; overflow: hidden;">
                      <tr>
                        <td style="padding: 16px; font-size: 18px; color: #111; font-weight: bold;">TOTAL ESTIMATE:</td>
                        <td style="padding: 16px; text-align: right; color: #fc6b04; font-weight: bold; font-size: 24px;">$${fmtMoney(total)}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              ${notes ? `
              <div style="margin: 24px 0; padding: 16px; background-color: #f9fafb; border-radius: 6px; border-left: 3px solid #0b3ea8;">
                <p style="margin: 0 0 4px 0; font-size: 12px; color: #666; font-weight: bold; text-transform: uppercase;">Notes:</p>
                <p style="margin: 0; font-size: 14px; color: #333; line-height: 1.6;">${notes}</p>
              </div>
              ` : ''}

              <!-- View & Print Button -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin: 30px 0;">
                <tr>
                  <td align="center">
                    <a href="${viewLink}" style="display: inline-block; padding: 16px 40px; background-color: #fc6b04; color: #ffffff; text-decoration: none; border-radius: 8px; font-size: 18px; font-weight: bold; box-shadow: 0 2px 4px rgba(252, 107, 4, 0.3);">
                      📄 View & Print Estimate
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin: 20px 0 10px 0; font-size: 14px; color: #666; text-align: center; line-height: 1.6;">
                Click the button above to view the complete estimate and print a copy for your records.
              </p>

              <p style="margin: 20px 0; font-size: 14px; color: #666; line-height: 1.6; text-align: center;">
                This estimate is valid for 30 days. If you have questions or would like to proceed, please contact us.
              </p>

              <p style="margin: 20px 0 0 0; font-size: 16px; color: #333; text-align: center;">
                Thank you for the opportunity!<br>
                <strong>${companyName}</strong>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 20px 30px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0; font-size: 12px; color: #666;">
                ${companyName}<br>
                Phone: (337)288-0395 • Email: info@dmlelectrical.com
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
        subject: `Estimate #${estimateNumber}${projectName && projectName !== 'Quick Estimate' ? ` - ${projectName}` : ''} - $${fmtMoney(total)}`,
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
        message: 'Estimate sent successfully',
        emailId: data.id 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error sending estimate:', error)
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Failed to send estimate',
        details: error.toString()
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
