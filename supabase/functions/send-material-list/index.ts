import { corsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
    const TWILIO_ACCOUNT_SID = Deno.env.get('TWILIO_ACCOUNT_SID')
    const TWILIO_AUTH_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN')
    const TWILIO_FROM_NUMBER = Deno.env.get('TWILIO_FROM_NUMBER')

    const {
      sendTo,          // { email?: string, phone?: string }
      projectName,
      listTitle,
      listDescription,
      listStatus,
      listDate,
      items,           // [{ quantity, unit, description }]
      companyName = 'DML Electrical Service, LLC',
    } = await req.json()

    if (!sendTo?.email && !sendTo?.phone) {
      return new Response(
        JSON.stringify({ error: 'Email or phone number is required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    if (!items || items.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No items to send' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    const results: { email?: string; sms?: string } = {}

    // ── EMAIL via Resend ────────────────────────────────────────────────────
    if (sendTo.email && RESEND_API_KEY) {
      const tableRows = items.map((item: any) => `
        <tr>
          <td style="padding:7px 12px;border-bottom:1px solid #e5e7eb;text-align:center;font-size:14px;">${item.quantity || ''}</td>
          <td style="padding:7px 12px;border-bottom:1px solid #e5e7eb;text-align:center;font-size:14px;">${item.unit || 'ea'}</td>
          <td style="padding:7px 12px;border-bottom:1px solid #e5e7eb;font-size:14px;">${item.description || ''}</td>
        </tr>
      `).join('')

      const htmlBody = `
        <!DOCTYPE html>
        <html>
        <head><meta charset="utf-8"></head>
        <body style="font-family:Arial,sans-serif;background:#f4f4f4;margin:0;padding:20px;">
          <div style="max-width:640px;margin:0 auto;background:#fff;border-radius:10px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.1);">
            <!-- Header -->
            <div style="background:#0b3ea8;padding:24px 32px;">
              <h1 style="color:#f97316;margin:0;font-size:22px;">${companyName}</h1>
              <p style="color:#fff;margin:6px 0 0;font-size:14px;">Material List</p>
            </div>
            <!-- Body -->
            <div style="padding:28px 32px;">
              <h2 style="font-size:20px;color:#111;margin:0 0 4px;">${projectName}</h2>
              <h3 style="font-size:16px;color:#333;margin:0 0 8px;font-weight:600;">${listTitle}</h3>
              ${listDescription ? `<p style="font-size:14px;color:#555;margin:0 0 16px;">${listDescription}</p>` : ''}
              <p style="font-size:13px;color:#888;margin:0 0 24px;">
                ${listDate ? `Date: ${listDate}` : ''} &nbsp;|&nbsp; Items: ${items.length} &nbsp;|&nbsp; Status: ${listStatus || 'draft'}
              </p>

              <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border:1px solid #e5e7eb;border-radius:6px;overflow:hidden;">
                <thead>
                  <tr style="background:#1e3a5f;">
                    <th style="padding:10px 12px;color:#fff;font-size:13px;text-align:center;width:60px;">Qty</th>
                    <th style="padding:10px 12px;color:#fff;font-size:13px;text-align:center;width:60px;">Unit</th>
                    <th style="padding:10px 12px;color:#fff;font-size:13px;text-align:left;">Description</th>
                  </tr>
                </thead>
                <tbody>${tableRows}</tbody>
              </table>
            </div>
            <div style="padding:16px 32px;background:#f9fafb;border-top:1px solid #e5e7eb;font-size:12px;color:#888;text-align:center;">
              Sent from ${companyName}
            </div>
          </div>
        </body>
        </html>
      `

      const emailRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'materials@dmlelectrical.com',
          to: sendTo.email,
          subject: `📋 Material List: ${listTitle} — ${projectName}`,
          html: htmlBody,
        }),
      })

      const emailData = await emailRes.json()
      if (!emailRes.ok) {
        console.error('Resend error:', emailData)
        results.email = `Error: ${emailData.message || 'Failed to send email'}`
      } else {
        results.email = 'sent'
      }
    }

    // ── SMS via Twilio ──────────────────────────────────────────────────────
    if (sendTo.phone && TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && TWILIO_FROM_NUMBER) {
      // Build a plain-text material list for SMS
      const itemLines = items
        .slice(0, 30) // SMS has character limits; cap at 30 items
        .map((item: any) => `• ${item.quantity} ${item.unit} — ${item.description}`)
        .join('\n')

      const moreNote = items.length > 30 ? `\n...and ${items.length - 30} more items` : ''

      const smsBody = [
        `📋 ${projectName}`,
        `${listTitle}`,
        listDescription ? listDescription : '',
        ``,
        itemLines + moreNote,
        ``,
        `— ${companyName}`,
      ].filter(l => l !== undefined).join('\n').trim()

      // Normalize phone: ensure +1 prefix for US numbers
      let toPhone = sendTo.phone.replace(/\D/g, '')
      if (toPhone.length === 10) toPhone = `+1${toPhone}`
      else if (!toPhone.startsWith('+')) toPhone = `+${toPhone}`

      const twilioRes = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`)}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            From: TWILIO_FROM_NUMBER,
            To: toPhone,
            Body: smsBody,
          }).toString(),
        }
      )

      const twilioData = await twilioRes.json()
      if (!twilioRes.ok) {
        console.error('Twilio error:', twilioData)
        results.sms = `Error: ${twilioData.message || 'Failed to send SMS'}`
      } else {
        results.sms = 'sent'
      }
    } else if (sendTo.phone && (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN)) {
      results.sms = 'Error: Twilio not configured on server'
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (err) {
    console.error('send-material-list error:', err)
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
