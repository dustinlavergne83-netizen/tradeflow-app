// Simplified Invoice Email Function - Summary + View Link
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
      customerName,
      invoiceNumber,
      invoiceDate,
      dueDate,
      lineItems,
      subtotal,
      amountPaid,
      balanceDue,
      notes,
      invoiceId,
      siteUrl,
      companyName = "DML Electrical Service, LLC"
    } = await req.json()

    if (!to) {
      return new Response(
        JSON.stringify({ error: 'Recipient email is required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    if (!invoiceId || !siteUrl) {
      return new Response(
        JSON.stringify({ error: 'Invoice ID and site URL are required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    const formatDate = (dateStr) => {
      if (!dateStr) return 'N/A';
      return new Date(dateStr).toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
    };

    const invoiceUrl = `${siteUrl}/invoice/view?invoiceId=${invoiceId}`;
    
    // Generate simple line items summary (first 3 items)
    const itemsSummary = lineItems && lineItems.length > 0 
      ? lineItems.slice(0, 3).map(item => {
          const desc = item.description || "";
          const firstLine = desc.split('\n')[0];
          return `• ${firstLine}`;
        }).join('<br>')
      : 'See invoice for details';
    
    const moreItems = lineItems && lineItems.length > 3 ? `<br>• ... and ${lineItems.length - 3} more item(s)` : '';

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Invoice - ${invoiceNumber}</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          
          <!-- Header -->
          <tr>
            <td style="background-color: #0b3ea8; padding: 30px; text-align: center;">
              <h1 style="color: #f97316; margin: 0 0 10px 0; font-size: 36px;">INVOICE</h1>
              <p style="color: #ffffff; margin: 0; font-size: 16px;">${companyName}</p>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 40px 30px;">
              
              <h2 style="color: #111; margin: 0 0 20px 0; font-size: 24px; text-align: center;">
                Invoice #${invoiceNumber}
              </h2>

              <!-- Key Details -->
              <table width="100%" style="margin-bottom: 30px;">
                <tr>
                  <td style="padding: 12px 0;">
                    <p style="margin: 0; font-size: 14px; color: #666;">Bill To:</p>
                    <p style="margin: 4px 0 0 0; font-size: 18px; color: #111; font-weight: 600;">${customerName || 'Customer'}</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 12px 0;">
                    <p style="margin: 0; font-size: 14px; color: #666;">Invoice Date:</p>
                    <p style="margin: 4px 0 0 0; font-size: 16px; color: #111; font-weight: 600;">${formatDate(invoiceDate)}</p>
                  </td>
                </tr>
                ${dueDate ? `
                <tr>
                  <td style="padding: 12px 0;">
                    <p style="margin: 0; font-size: 14px; color: #666;">Due Date:</p>
                    <p style="margin: 4px 0 0 0; font-size: 16px; color: ${new Date(dueDate) < new Date() && balanceDue > 0 ? '#ef4444' : '#111'}; font-weight: 600;">${formatDate(dueDate)}</p>
                  </td>
                </tr>
                ` : ''}
              </table>

              <!-- Line Items Summary -->
              <div style="margin-bottom: 30px; padding: 20px; background-color: #f9fafb; border-radius: 8px; border-left: 4px solid #0b3ea8;">
                <p style="margin: 0 0 12px 0; font-size: 14px; color: #666; font-weight: bold; text-transform: uppercase;">Services & Items:</p>
                <p style="margin: 0; font-size: 15px; color: #333; line-height: 1.8;">
                  ${itemsSummary}${moreItems}
                </p>
              </div>

              <!-- Amount Summary -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 30px;">
                <tr>
                  <td style="padding: 15px 20px; background-color: #f3f4f6; border-radius: 8px;">
                    <table width="100%">
                      <tr>
                        <td>
                          <p style="margin: 0; font-size: 16px; color: #666;">Subtotal:</p>
                        </td>
                        <td style="text-align: right;">
                          <p style="margin: 0; font-size: 18px; color: #111; font-weight: 600;">$${(subtotal || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
                        </td>
                      </tr>
                      ${amountPaid > 0 ? `
                      <tr>
                        <td style="padding-top: 8px;">
                          <p style="margin: 0; font-size: 16px; color: #666;">Amount Paid:</p>
                        </td>
                        <td style="text-align: right; padding-top: 8px;">
                          <p style="margin: 0; font-size: 18px; color: #10b981; font-weight: 600;">-$${(amountPaid || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
                        </td>
                      </tr>
                      ` : ''}
                      <tr>
                        <td style="padding-top: 12px; border-top: 2px solid #e5e7eb;">
                          <p style="margin: 0; font-size: 18px; color: #111; font-weight: bold;">BALANCE DUE:</p>
                        </td>
                        <td style="text-align: right; padding-top: 12px; border-top: 2px solid #e5e7eb;">
                          <p style="margin: 0; font-size: 24px; color: ${balanceDue > 0 ? '#ef4444' : '#10b981'}; font-weight: bold;">$${(balanceDue || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- View & Print Button -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin: 30px 0;">
                <tr>
                  <td align="center">
                    <a href="${invoiceUrl}" style="display: inline-block; padding: 16px 40px; background-color: #fc6b04; color: #ffffff; text-decoration: none; border-radius: 8px; font-size: 18px; font-weight: bold; box-shadow: 0 2px 4px rgba(252, 107, 4, 0.3);">
                      📄 View & Print Invoice
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin: 20px 0 10px 0; font-size: 14px; color: #666; text-align: center; line-height: 1.6;">
                Click the button above to view the complete invoice details and print a copy for your records.
              </p>

              ${balanceDue > 0 ? `
              <div style="margin: 30px 0; padding: 20px; background-color: #fef3c7; border-left: 4px solid #f59e0b; border-radius: 4px;">
                <p style="margin: 0; color: #78350f; font-size: 14px; line-height: 1.6;">
                  <strong>Payment Due:</strong> Please remit payment by ${formatDate(dueDate)}. Make checks payable to ${companyName}.
                </p>
              </div>
              ` : `
              <div style="margin: 30px 0; padding: 20px; background-color: #d1fae5; border-left: 4px solid #10b981; border-radius: 4px;">
                <p style="margin: 0; color: #065f46; font-size: 14px; line-height: 1.6;">
                  <strong>✓ Paid in Full</strong> - Thank you for your prompt payment!
                </p>
              </div>
              `}

              <p style="margin: 30px 0 10px 0; font-size: 14px; color: #333; text-align: center; line-height: 1.6;">
                If you have any questions about this invoice, please contact us at your earliest convenience.
              </p>

              <p style="margin: 20px 0 10px 0; font-size: 16px; color: #333; text-align: center;">
                Thank you for your business!<br>
                <strong>${companyName}</strong>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 20px 30px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0; font-size: 12px; color: #666;">
                ${companyName}<br>
                Phone: (555) 123-4567 • Email: info@dmlelectrical.com
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
    const emailAddresses = to.split(/[,;]/).map(email => email.trim()).filter(email => email.length > 0);
    
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'invoices@dmlelectrical.com',
        to: emailAddresses,
        bcc: ['dustin@dmlelectrical.com'],
        subject: `Invoice #${invoiceNumber}${dueDate ? ` - Due ${formatDate(dueDate)}` : ''}`,
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
        message: 'Invoice sent successfully',
        emailId: data.id 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error sending invoice:', error)
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Failed to send invoice',
        details: error.toString()
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
