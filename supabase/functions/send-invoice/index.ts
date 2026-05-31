// Detailed Invoice Email Function - Full breakdown with labor, materials, markup, deposits
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
      totalMarkup = 0,
      totalWithMarkup,
      depositReceived = 0,
      amountPaid,
      balanceDue,
      markupDetails = [],
      notes,
      invoiceId,
      siteUrl,
      companyName = "DML Electrical Service, LLC",
      isReceipt = false,
      receiptSummary = []
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

    const formatDate = (dateStr: string) => {
      if (!dateStr) return 'N/A';
      return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
    };

    const formatShortDate = (dateStr: string) => {
      if (!dateStr) return '';
      return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric' 
      });
    };

    const fmtMoney = (amount: number) => {
      return (amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

    // Resolve effective site URL — never use localhost in email links.
    // Priority: SITE_URL env var > provided siteUrl (if not localhost) > error
    const envSiteUrl = Deno.env.get('SITE_URL');
    let effectiveSiteUrl = siteUrl;
    if (envSiteUrl) {
      effectiveSiteUrl = envSiteUrl; // Always prefer the server-side env var
    } else if (!siteUrl || siteUrl.includes('localhost') || siteUrl.includes('127.0.0.1')) {
      return new Response(
        JSON.stringify({
          error: 'Email links cannot point to localhost. Access your app from its production URL, or set the SITE_URL secret in Supabase Dashboard → Edge Functions → Secrets.'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    const invoiceUrl = isReceipt 
      ? `${effectiveSiteUrl}/invoice/receipt?invoiceId=${invoiceId}`
      : `${effectiveSiteUrl}/invoice/view?invoiceId=${invoiceId}`;
    
    // Use totalWithMarkup if provided, otherwise fall back to subtotal
    const displayTotal = totalWithMarkup || subtotal || 0;
    const hasMarkup = totalMarkup > 0;
    const hasDeposit = depositReceived > 0;
    const totalPayments = (depositReceived || 0) + (amountPaid || 0);

    // Build detailed line items HTML
    let lineItemsHtml = '';
    lineItems?.forEach((item: any) => {
      const desc = (item.description || '').split('\n')[0];
      const qty = item.quantity || 0;
      const baseRate = item.unit_price || 0;
      const markupPct = item.markupPercent || 0;
      // Show the marked-up rate (e.g. $67.50 with 100% markup = $135.00)
      const billedRate = baseRate * (1 + markupPct / 100);
      const billedTotal = qty * billedRate;

      lineItemsHtml += `
        <tr>
          <td style="padding: 12px 8px; border-bottom: 1px solid #e5e7eb; font-size: 14px; color: #111; font-weight: 600;">${desc}</td>
          <td style="padding: 12px 8px; border-bottom: 1px solid #e5e7eb; font-size: 14px; color: #666; text-align: center;">${parseFloat(qty.toFixed(2))}</td>
          <td style="padding: 12px 8px; border-bottom: 1px solid #e5e7eb; font-size: 14px; color: #666; text-align: right;">$${fmtMoney(billedRate)}</td>
          <td style="padding: 12px 8px; border-bottom: 1px solid #e5e7eb; font-size: 14px; color: #111; text-align: right; font-weight: 600;">$${fmtMoney(billedTotal)}</td>
        </tr>`;
    });

    // Build labor details HTML
    let laborDetailsHtml = '';
    lineItems?.forEach((item: any) => {
      const laborDetails = item.laborDetails || [];
      if (laborDetails.length === 0) return;
      
      // Get the markup for this labor item
      const laborMarkupPct = item.markupPercent || 0;

      laborDetailsHtml += `
        <tr><td colspan="4" style="padding: 16px 8px 8px 8px;">
          <p style="margin: 0 0 8px 0; font-size: 15px; font-weight: bold; color: #0b3ea8;">⏱️ Labor Breakdown</p>
        </td></tr>`;

      laborDetails.forEach((emp: any) => {
        const billedEmpRate = (emp.rate || 0) * (1 + laborMarkupPct / 100);
        const billedEmpTotal = emp.totalHours * billedEmpRate;
        laborDetailsHtml += `
          <tr><td colspan="4" style="padding: 8px; background-color: #f0f9ff;">
            <p style="margin: 0 0 4px 0; font-size: 14px; font-weight: 600; color: #111;">👷 ${emp.employee}</p>
            <p style="margin: 0; font-size: 13px; color: #666;">${emp.totalHours} hrs × $${fmtMoney(billedEmpRate)}/hr = <strong>$${fmtMoney(billedEmpTotal)}</strong></p>
          </td></tr>`;

        // Daily entries for this employee
        if (emp.entries && emp.entries.length > 0) {
          laborDetailsHtml += `
            <tr><td colspan="4" style="padding: 0 8px 8px 24px;">
              <table width="100%" style="border-collapse: collapse;">
                <tr style="background-color: #f3f4f6;">
                  <td style="padding: 4px 8px; font-size: 11px; color: #666; font-weight: bold;">DATE</td>
                  <td style="padding: 4px 8px; font-size: 11px; color: #666; font-weight: bold; text-align: center;">CLOCK IN</td>
                  <td style="padding: 4px 8px; font-size: 11px; color: #666; font-weight: bold; text-align: center;">CLOCK OUT</td>
                  <td style="padding: 4px 8px; font-size: 11px; color: #666; font-weight: bold; text-align: right;">HOURS</td>
                </tr>`;
          
          emp.entries.forEach((entry: any) => {
            laborDetailsHtml += `
                <tr>
                  <td style="padding: 3px 8px; font-size: 12px; color: #444;">${formatShortDate(entry.date)}</td>
                  <td style="padding: 3px 8px; font-size: 12px; color: #444; text-align: center;">${entry.clockIn || ''}</td>
                  <td style="padding: 3px 8px; font-size: 12px; color: #444; text-align: center;">${entry.clockOut || ''}</td>
                  <td style="padding: 3px 8px; font-size: 12px; color: #444; text-align: right;">${entry.hours}</td>
                </tr>`;
          });

          laborDetailsHtml += `
              </table>
            </td></tr>`;
        }
      });
    });

    // Build materials details HTML
    let materialsDetailsHtml = '';
    lineItems?.forEach((item: any) => {
      const materialDetails = item.materialDetails || [];
      if (materialDetails.length === 0) return;

      materialsDetailsHtml += `
        <tr><td colspan="4" style="padding: 16px 8px 8px 8px;">
          <p style="margin: 0 0 8px 0; font-size: 15px; font-weight: bold; color: #0b3ea8;">🧾 Materials & Expenses Breakdown</p>
        </td></tr>
        <tr><td colspan="4" style="padding: 0 8px 8px 8px;">
          <table width="100%" style="border-collapse: collapse;">
            <tr style="background-color: #f3f4f6;">
              <td style="padding: 6px 8px; font-size: 11px; color: #666; font-weight: bold;">DESCRIPTION</td>
              <td style="padding: 6px 8px; font-size: 11px; color: #666; font-weight: bold;">VENDOR</td>
              <td style="padding: 6px 8px; font-size: 11px; color: #666; font-weight: bold; text-align: center;">DATE</td>
              <td style="padding: 6px 8px; font-size: 11px; color: #666; font-weight: bold; text-align: right;">AMOUNT</td>
            </tr>`;

      materialDetails.forEach((mat: any) => {
        materialsDetailsHtml += `
            <tr>
              <td style="padding: 4px 8px; font-size: 12px; color: #444;">${mat.description || ''}</td>
              <td style="padding: 4px 8px; font-size: 12px; color: #444;">${mat.vendor || ''}</td>
              <td style="padding: 4px 8px; font-size: 12px; color: #444; text-align: center;">${formatShortDate(mat.date)}</td>
              <td style="padding: 4px 8px; font-size: 12px; color: #444; text-align: right;">$${fmtMoney(mat.amount)}</td>
            </tr>`;
      });

      materialsDetailsHtml += `
          </table>
        </td></tr>`;
    });

    // No markup section in email - customer only sees final prices

    // ===== RECEIPT EMAIL TEMPLATE =====
    let receiptSummaryHtml = '';
    if (isReceipt && receiptSummary && receiptSummary.length > 0) {
      receiptSummary.forEach((line: any) => {
        receiptSummaryHtml += `
          <tr>
            <td style="padding: 14px 16px; border-bottom: 1px solid #e5e7eb; font-size: 16px; color: #111;">${line.label}</td>
            <td style="padding: 14px 16px; border-bottom: 1px solid #e5e7eb; font-size: 16px; color: #111; text-align: right; font-weight: 600;">$${fmtMoney(line.amount)}</td>
          </tr>`;
      });
    }

    const receiptHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Payment Receipt - Invoice #${invoiceNumber}</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          
          <!-- Header -->
          <tr>
            <td style="background-color: #0b3ea8; padding: 30px; text-align: center;">
              <h1 style="color: #10b981; margin: 0 0 6px 0; font-size: 32px;">✅ PAYMENT RECEIPT</h1>
              <p style="color: #ffffff; margin: 0; font-size: 16px;">${companyName}</p>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 30px;">
              
              <p style="text-align: center; font-size: 15px; color: #666; margin: 0 0 24px 0;">
                Invoice #${invoiceNumber} &bull; ${formatDate(invoiceDate)}
              </p>

              <!-- Paid Confirmation -->
              <div style="background-color: #ecfdf5; border: 2px solid #10b981; border-radius: 10px; padding: 20px; text-align: center; margin-bottom: 24px;">
                <p style="margin: 0; font-size: 18px; color: #065f46; font-weight: bold;">
                  Payment of $${fmtMoney(totalPayments)} received
                </p>
                <p style="margin: 8px 0 0 0; font-size: 14px; color: #065f46;">
                  This invoice has been paid in full. Thank you!
                </p>
              </div>

              <!-- Customer & Project -->
              <table width="100%" style="margin-bottom: 24px;">
                <tr>
                  <td width="50%" style="padding: 8px 0; vertical-align: top;">
                    <p style="margin: 0; font-size: 11px; color: #999; text-transform: uppercase; letter-spacing: 0.5px;">Received From:</p>
                    <p style="margin: 4px 0 0 0; font-size: 17px; color: #111; font-weight: 600;">${customerName || 'Customer'}</p>
                  </td>
                  <td width="50%" style="padding: 8px 0; vertical-align: top; text-align: right;">
                    <p style="margin: 0; font-size: 11px; color: #999; text-transform: uppercase; letter-spacing: 0.5px;">Date Paid:</p>
                    <p style="margin: 4px 0 0 0; font-size: 17px; color: #111; font-weight: 600;">${formatDate(invoiceDate)}</p>
                  </td>
                </tr>
              </table>

              <!-- Summary Table -->
              <table width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; margin-bottom: 20px;">
                <tr style="background-color: #f9fafb;">
                  <td style="padding: 10px 16px; font-size: 12px; color: #666; font-weight: bold; text-transform: uppercase;">Description</td>
                  <td style="padding: 10px 16px; font-size: 12px; color: #666; font-weight: bold; text-transform: uppercase; text-align: right;">Amount</td>
                </tr>
                ${receiptSummaryHtml}
              </table>

              <!-- Totals -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 24px;">
                <tr>
                  <td width="50%"></td>
                  <td width="50%">
                    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9fafb; border-radius: 8px; padding: 12px;">
                      <tr>
                        <td style="padding: 6px 16px; font-size: 14px; color: #666;">Invoice Total:</td>
                        <td style="padding: 6px 16px; font-size: 14px; color: #111; text-align: right; font-weight: 600;">$${fmtMoney(displayTotal)}</td>
                      </tr>
                      ${hasDeposit ? `
                      <tr>
                        <td style="padding: 6px 16px; font-size: 14px; color: #10b981;">Deposit Applied:</td>
                        <td style="padding: 6px 16px; font-size: 14px; color: #10b981; text-align: right; font-weight: 600;">-$${fmtMoney(depositReceived)}</td>
                      </tr>
                      ` : ''}
                      ${(amountPaid || 0) > 0 ? `
                      <tr>
                        <td style="padding: 6px 16px; font-size: 14px; color: #10b981;">Payment Received:</td>
                        <td style="padding: 6px 16px; font-size: 14px; color: #10b981; text-align: right; font-weight: 600;">-$${fmtMoney(amountPaid)}</td>
                      </tr>
                      ` : ''}
                      <tr>
                        <td style="padding: 12px 16px; font-size: 18px; color: #111; font-weight: bold; border-top: 2px solid #e5e7eb;">Balance Due:</td>
                        <td style="padding: 12px 16px; font-size: 22px; color: #10b981; text-align: right; font-weight: bold; border-top: 2px solid #e5e7eb;">$0.00</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- View Receipt Button -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin: 24px 0;">
                <tr>
                  <td align="center">
                    <a href="${invoiceUrl}" style="display: inline-block; padding: 14px 36px; background-color: #10b981; color: #ffffff; text-decoration: none; border-radius: 8px; font-size: 16px; font-weight: bold;">
                      🧾 View Receipt
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin: 20px 0 0 0; font-size: 14px; color: #333; text-align: center;">
                Thank you for your business!<br>
                <strong>${companyName}</strong>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 16px 30px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0; font-size: 12px; color: #666;">
                ${companyName}<br>
                Phone: (337) 660-4946 &bull; Email: dustin@dmlelectrical.com
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

    const html = isReceipt ? receiptHtml : `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Invoice #${invoiceNumber}</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 20px;">
    <tr>
      <td align="center">
        <table width="700" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          
          <!-- Header -->
          <tr>
            <td style="background-color: #0b3ea8; padding: 30px; text-align: center;">
              <h1 style="color: #f97316; margin: 0 0 10px 0; font-size: 36px;">INVOICE</h1>
              <p style="color: #ffffff; margin: 0; font-size: 16px;">${companyName}</p>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 30px;">
              
              <h2 style="color: #111; margin: 0 0 20px 0; font-size: 24px; text-align: center;">
                Invoice #${invoiceNumber}
              </h2>

              <!-- Key Details -->
              <table width="100%" style="margin-bottom: 24px;">
                <tr>
                  <td width="50%" style="padding: 8px 0; vertical-align: top;">
                    <p style="margin: 0; font-size: 12px; color: #666; text-transform: uppercase;">Bill To:</p>
                    <p style="margin: 4px 0 0 0; font-size: 16px; color: #111; font-weight: 600;">${customerName || 'Customer'}</p>
                  </td>
                  <td width="50%" style="padding: 8px 0; vertical-align: top; text-align: right;">
                    <p style="margin: 0; font-size: 12px; color: #666; text-transform: uppercase;">Invoice Date:</p>
                    <p style="margin: 4px 0 0 0; font-size: 16px; color: #111; font-weight: 600;">${formatDate(invoiceDate)}</p>
                    ${dueDate ? `
                    <p style="margin: 8px 0 0 0; font-size: 12px; color: #666; text-transform: uppercase;">Due Date:</p>
                    <p style="margin: 4px 0 0 0; font-size: 16px; color: #111; font-weight: 600;">${formatDate(dueDate)}</p>
                    ` : ''}
                  </td>
                </tr>
              </table>

              <!-- Line Items Table -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 0; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
                <tr style="background-color: #0b3ea8;">
                  <td style="padding: 10px 8px; font-size: 12px; color: #fff; font-weight: bold; text-transform: uppercase;">Description</td>
                  <td style="padding: 10px 8px; font-size: 12px; color: #fff; font-weight: bold; text-transform: uppercase; text-align: center;">Qty</td>
                  <td style="padding: 10px 8px; font-size: 12px; color: #fff; font-weight: bold; text-transform: uppercase; text-align: right;">Rate</td>
                  <td style="padding: 10px 8px; font-size: 12px; color: #fff; font-weight: bold; text-transform: uppercase; text-align: right;">Amount</td>
                </tr>
                ${lineItemsHtml}

                <!-- Labor Details -->
                ${laborDetailsHtml}

                <!-- Materials Details -->
                ${materialsDetailsHtml}

              </table>

              <!-- Totals -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-top: 20px;">
                <tr>
                  <td width="50%"></td>
                  <td width="50%">
                    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9fafb; border-radius: 8px; padding: 16px;">
                      <tr>
                        <td style="padding: 6px 16px; font-size: 14px; color: #666;">Subtotal:</td>
                        <td style="padding: 6px 16px; font-size: 14px; color: #111; text-align: right; font-weight: 600;">$${fmtMoney(displayTotal)}</td>
                      </tr>
                      ${hasDeposit ? `
                      <tr>
                        <td style="padding: 6px 16px; font-size: 14px; color: #10b981;">Deposit Received:</td>
                        <td style="padding: 6px 16px; font-size: 14px; color: #10b981; text-align: right; font-weight: 600;">-$${fmtMoney(depositReceived)}</td>
                      </tr>
                      ` : ''}
                      ${(amountPaid || 0) > 0 ? `
                      <tr>
                        <td style="padding: 6px 16px; font-size: 14px; color: #10b981;">Amount Paid:</td>
                        <td style="padding: 6px 16px; font-size: 14px; color: #10b981; text-align: right; font-weight: 600;">-$${fmtMoney(amountPaid)}</td>
                      </tr>
                      ` : ''}
                      <tr>
                        <td style="padding: 12px 16px; font-size: 18px; color: #111; font-weight: bold; border-top: 2px solid #e5e7eb;">BALANCE DUE:</td>
                        <td style="padding: 12px 16px; font-size: 22px; color: ${(balanceDue || 0) > 0 ? '#ef4444' : '#10b981'}; text-align: right; font-weight: bold; border-top: 2px solid #e5e7eb;">$${fmtMoney(balanceDue)}</td>
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

              <!-- View / Print / Pay Button -->
              ${(balanceDue || 0) > 0 ? `
              <table width="100%" cellpadding="0" cellspacing="0" style="margin: 24px 0 12px 0;">
                <tr>
                  <td align="center">
                    <a href="${invoiceUrl}" style="display: inline-block; padding: 18px 48px; background-color: #16a34a; color: #ffffff; text-decoration: none; border-radius: 10px; font-size: 19px; font-weight: bold; box-shadow: 0 4px 12px rgba(22,163,74,0.35); letter-spacing: 0.3px;">
                      📄 View or Print / Pay Invoice
                    </a>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding-top: 8px;">
                    <p style="margin: 0; font-size: 12px; color: #6b7280;">🔒 Secure online payment &bull; Credit card or ACH bank transfer &bull; No fee for ACH</p>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding-top: 10px;">
                    <p style="margin: 0; font-size: 11px; color: #9ca3af;">Button not working? Copy &amp; paste this link:</p>
                    <p style="margin: 4px 0 0 0; font-size: 12px; color: #0b3ea8; word-break: break-all;">${invoiceUrl}</p>
                  </td>
                </tr>
              </table>

              <div style="margin: 12px 0 20px 0; padding: 14px 16px; background-color: #fef3c7; border-left: 4px solid #f59e0b; border-radius: 4px;">
                <p style="margin: 0; color: #78350f; font-size: 14px; line-height: 1.6;">
                  <strong>Payment Due${dueDate ? ` by ${formatDate(dueDate)}` : ''}.</strong>
                  Pay online with a credit card or ACH bank transfer, or make checks payable to ${companyName}.
                </p>
              </div>
              ` : `
              <!-- View Invoice (paid) -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin: 24px 0;">
                <tr>
                  <td align="center">
                    <a href="${invoiceUrl}" style="display: inline-block; padding: 16px 40px; background-color: #fc6b04; color: #ffffff; text-decoration: none; border-radius: 8px; font-size: 18px; font-weight: bold; box-shadow: 0 2px 4px rgba(252, 107, 4, 0.3);">
                      📄 View or Print Invoice
                    </a>
                  </td>
                </tr>
              </table>

              <div style="margin: 20px 0; padding: 16px; background-color: #d1fae5; border-left: 4px solid #10b981; border-radius: 4px;">
                <p style="margin: 0; color: #065f46; font-size: 14px;">
                  <strong>✓ Paid in Full</strong> - Thank you for your prompt payment!
                </p>
              </div>
              `}

              <p style="margin: 20px 0 0 0; font-size: 14px; color: #333; text-align: center;">
                Thank you for your business!<br>
                <strong>${companyName}</strong>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 16px 30px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0; font-size: 12px; color: #666;">
                ${companyName}<br>
                Phone: (337) 660-4946 • Email: dustin@dmlelectrical.com
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
        subject: isReceipt 
          ? `Payment Receipt - Invoice #${invoiceNumber} - PAID $${fmtMoney(totalPayments)}`
          : `Invoice #${invoiceNumber} - $${fmtMoney(balanceDue)} Due${dueDate ? ` by ${formatDate(dueDate)}` : ''}`,
        html: html,
        // Disable click tracking to avoid resend-clicks.com SSL redirect issues
        // when domain is not yet verified
        tags: [{ name: 'category', value: 'invoice' }],
        headers: {
          'X-Entity-Ref-ID': `invoice-${invoiceId}`,
        },
      }),
    })

    const data = await res.json()

    if (!res.ok) {
      console.error('Resend API Error Status:', res.status)
      console.error('Resend API Error Body:', JSON.stringify(data))
      const resendMsg = data.message || data.name || data.error || JSON.stringify(data)
      // Provide a specific, actionable message for domain verification errors
      if (res.status === 403 || (resendMsg && resendMsg.toLowerCase().includes('domain') && resendMsg.toLowerCase().includes('not verified'))) {
        throw new Error(
          `Email domain not verified.\n\n` +
          `To fix this:\n` +
          `1. Log into resend.com\n` +
          `2. Go to "Domains" and click "Add Domain"\n` +
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
        message: 'Invoice sent successfully',
        emailId: data.id 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error sending invoice:', error)
    // Return 200 with error payload so the client can read the actual message
    // (non-2xx responses cause Supabase client to throw a generic FunctionsHttpError
    //  that hides the real error details)
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message || 'Failed to send invoice',
        details: error.toString()
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  }
})
