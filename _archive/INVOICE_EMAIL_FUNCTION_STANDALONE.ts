// Standalone Invoice Email Function - Copy this entire file into Supabase Dashboard
// Function name: send-invoice

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

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
      invoiceNumber,
      invoiceDate,
      dueDate,
      lineItems,
      subtotal,
      amountPaid,
      balanceDue,
      notes,
      invoiceId,
      companyName = "DML Electrical Service, LLC",
      siteUrl = "https://your-site.com"
    } = await req.json()

    if (!to) {
      return new Response(
        JSON.stringify({ error: 'Recipient email is required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // Format dates
    const formatDate = (dateStr) => {
      if (!dateStr) return 'N/A';
      return new Date(dateStr).toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
    };

    // Create invoice view URL
    const invoiceUrl = `${siteUrl}/invoice/view?invoiceId=${invoiceId}`;
    
    // Check if this is a progress billing invoice
    const isProgressBilling = notes && notes.includes('Progress billing');
    
    // Generate simple line items summary (first 3 items)
    const itemsSummary = lineItems && lineItems.length > 0 
      ? lineItems.slice(0, 3).map(item => {
          const desc = item.description || "";
          const firstLine = desc.split('\n')[0];
          return `• ${firstLine}`;
        }).join('<br>')
      : 'See invoice for details';
    
    const moreItems = lineItems && lineItems.length > 3 ? `<br>• ... and ${lineItems.length - 3} more item(s)` : '';

    // Generate HTML email
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
        <table width="650" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          
          <!-- Header -->
          <tr>
            <td style="background-color: #0b3ea8; padding: 30px;">
              <table width="100%">
                <tr>
                  <td>
                    <h1 style="color: #f97316; margin: 0; font-size: 32px;">INVOICE</h1>
                    <p style="color: #ffffff; margin: 5px 0 0 0; font-size: 14px;">${companyName}</p>
                  </td>
                  <td style="text-align: right;">
                    <p style="color: #ffffff; margin: 0; font-size: 24px; font-weight: bold;">#${invoiceNumber}</p>
                    <p style="color: #ffffff; margin: 5px 0 0 0; font-size: 14px;">${formatDate(invoiceDate)}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 40px 30px;">
              
              <!-- Bill To Section -->
              <table width="100%" style="margin-bottom: 30px;">
                <tr>
                  <td>
                    <p style="margin: 0 0 5px 0; color: #666; font-size: 12px; text-transform: uppercase; font-weight: bold;">Bill To:</p>
                    <p style="margin: 0; font-size: 18px; color: #111; font-weight: 600;">${customerName || 'Customer'}</p>
                  </td>
                  <td style="text-align: right;">
                    ${dueDate ? `
                      <p style="margin: 0 0 5px 0; color: #666; font-size: 12px; text-transform: uppercase; font-weight: bold;">Due Date:</p>
                      <p style="margin: 0; font-size: 18px; color: ${new Date(dueDate) < new Date() && balanceDue > 0 ? '#ef4444' : '#111'}; font-weight: 600;">${formatDate(dueDate)}</p>
                    ` : ''}
                  </td>
                </tr>
              </table>

              <!-- Line Items Table -->
              ${isProgressBilling ? `
              <h3 style="font-size: 18px; font-weight: bold; margin-bottom: 16px; color: #111;">
                Progress Billing Summary
              </h3>
              <table width="100%" cellpadding="0" cellspacing="0" style="margin: 20px 0; border: 1px solid #e5e7eb; border-radius: 6px; overflow: hidden;">
                <thead>
                  <tr style="background-color: #f9fafb;">
                    <th style="padding: 12px 15px; text-align: left; border-bottom: 2px solid #e5e7eb; color: #666; font-size: 11px; text-transform: uppercase; font-weight: bold;">Item Description</th>
                    <th style="padding: 12px 15px; text-align: right; border-bottom: 2px solid #e5e7eb; color: #666; font-size: 11px; text-transform: uppercase; font-weight: bold; width: 100px;">Original Amount</th>
                    <th style="padding: 12px 15px; text-align: right; border-bottom: 2px solid #e5e7eb; color: #666; font-size: 11px; text-transform: uppercase; font-weight: bold; width: 100px;">This Invoice</th>
                    <th style="padding: 12px 15px; text-align: right; border-bottom: 2px solid #e5e7eb; color: #666; font-size: 11px; text-transform: uppercase; font-weight: bold; width: 80px;">% Billed</th>
                    <th style="padding: 12px 15px; text-align: right; border-bottom: 2px solid #e5e7eb; color: #666; font-size: 11px; text-transform: uppercase; font-weight: bold; width: 110px;">Previously Billed</th>
                    <th style="padding: 12px 15px; text-align: right; border-bottom: 2px solid #e5e7eb; color: #666; font-size: 11px; text-transform: uppercase; font-weight: bold; width: 100px;">Remaining</th>
                  </tr>
                </thead>
                <tbody>
                  ${lineItemsHtml}
                </tbody>
              </table>
              ` : `
              <table width="100%" cellpadding="0" cellspacing="0" style="margin: 20px 0; border: 1px solid #e5e7eb; border-radius: 6px; overflow: hidden;">
                <thead>
                  <tr style="background-color: #f9fafb;">
                    <th style="padding: 12px 15px; text-align: left; border-bottom: 2px solid #e5e7eb; color: #666; font-size: 12px; text-transform: uppercase; font-weight: bold;">Description</th>
                    <th style="padding: 12px 15px; text-align: center; border-bottom: 2px solid #e5e7eb; color: #666; font-size: 12px; text-transform: uppercase; font-weight: bold; width: 80px;">Qty</th>
                    <th style="padding: 12px 15px; text-align: right; border-bottom: 2px solid #e5e7eb; color: #666; font-size: 12px; text-transform: uppercase; font-weight: bold; width: 120px;">Unit Price</th>
                    <th style="padding: 12px 15px; text-align: right; border-bottom: 2px solid #e5e7eb; color: #666; font-size: 12px; text-transform: uppercase; font-weight: bold; width: 120px;">Total</th>
                  </tr>
                </thead>
                <tbody>
                  ${lineItemsHtml}
                </tbody>
              </table>
              `}

              <!-- Totals -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin: 30px 0;">
                <tr>
                  <td width="60%"></td>
                  <td width="40%">
                    <table width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid #e5e7eb; border-radius: 6px; overflow: hidden;">
                      <tr>
                        <td style="padding: 12px 15px; border-bottom: 1px solid #e5e7eb; color: #666; font-size: 14px;">
                          <strong>Subtotal:</strong>
                        </td>
                        <td style="padding: 12px 15px; border-bottom: 1px solid #e5e7eb; text-align: right; color: #111; font-size: 14px; font-weight: 600;">
                          $${(subtotal || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                      ${amountPaid > 0 ? `
                      <tr>
                        <td style="padding: 12px 15px; border-bottom: 1px solid #e5e7eb; color: #666; font-size: 14px;">
                          <strong>Amount Paid:</strong>
                        </td>
                        <td style="padding: 12px 15px; border-bottom: 1px solid #e5e7eb; text-align: right; color: #10b981; font-size: 14px; font-weight: 600;">
                          -$${(amountPaid || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                      ` : ''}
                      <tr style="background-color: #f9fafb;">
                        <td style="padding: 15px; color: #111; font-size: 16px;">
                          <strong>BALANCE DUE:</strong>
                        </td>
                        <td style="padding: 15px; text-align: right; color: ${balanceDue > 0 ? '#ef4444' : '#10b981'}; font-size: 20px; font-weight: bold;">
                          $${(balanceDue || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              ${notes ? `
              <!-- Notes -->
              <div style="margin: 30px 0; padding: 20px; background-color: #f9fafb; border-left: 4px solid #0b3ea8; border-radius: 4px;">
                <p style="margin: 0 0 8px 0; color: #666; font-size: 12px; text-transform: uppercase; font-weight: bold;">Notes:</p>
                <p style="margin: 0; color: #333; font-size: 14px; line-height: 1.6;">${notes}</p>
              </div>
              ` : ''}

              ${balanceDue > 0 ? `
              <div style="margin: 30px 0; padding: 20px; background-color: #fef3c7; border-left: 4px solid #f59e0b; border-radius: 4px;">
                <p style="margin: 0; color: #78350f; font-size: 14px; line-height: 1.6;">
                  <strong>Payment Due:</strong> Please remit payment by ${formatDate(dueDate)} to avoid late fees. Make checks payable to ${companyName}.
                </p>
              </div>
              ` : `
              <div style="margin: 30px 0; padding: 20px; background-color: #d1fae5; border-left: 4px solid #10b981; border-radius: 4px;">
                <p style="margin: 0; color: #065f46; font-size: 14px; line-height: 1.6;">
                  <strong>✓ Paid in Full</strong> - Thank you for your prompt payment!
                </p>
              </div>
              `}

              <p style="margin: 30px 0 10px 0; font-size: 14px; color: #333; line-height: 1.6;">
                If you have any questions about this invoice, please contact us at your earliest convenience.
              </p>

              <p style="margin: 30px 0 10px 0; font-size: 16px; color: #333;">
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
                123 Main Street, City, State 12345<br>
                Phone: (555) 123-4567 • Email: info@company.com
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

    // Send email via Resend
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'invoices@dmlelectrical.com',
        to: [to],
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
