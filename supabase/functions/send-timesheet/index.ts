// Send Weekly Timesheet as PDF Attachment via Resend
import { corsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
    if (!RESEND_API_KEY) throw new Error('RESEND_API_KEY not set')

    const { weekLabel, pdfBase64, to, cc, subject } = await req.json()

    if (!pdfBase64) {
      return new Response(JSON.stringify({ error: 'pdfBase64 is required' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400
      })
    }

    // Use provided recipients or fall back to default
    const toAddress = to || 'dustin@dmlelectrical.com'
    const emailSubject = subject || `Employee Timesheets — Week of ${weekLabel} — DML Electrical`
    const fileName = `DML_Timesheets_${(weekLabel || 'week').replace(/[^a-zA-Z0-9]/g, '_')}.pdf`

    // Parse CC addresses (comma-separated string → array)
    const ccArray: string[] = cc
      ? cc.split(',').map((s: string) => s.trim()).filter(Boolean)
      : []

    const emailPayload: Record<string, unknown> = {
      from: 'DML Electrical Service <noreply@dmlelectrical.com>',
      reply_to: 'dustin@dmlelectrical.com',
      to: [toAddress],
      ...(ccArray.length > 0 ? { cc: ccArray } : {}),
      subject: emailSubject,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #f9fafb; padding: 24px; border: 1px solid #e5e7eb; border-radius: 8px;">
            <h1 style="color: #0b3ea8; margin: 0 0 8px; font-size: 22px;">DML Electrical Service, LLC</h1>
            <p style="color: #374151; margin: 0 0 16px; font-size: 14px;">Employee Timesheets — Week of ${weekLabel}</p>
            <p style="color: #111; font-size: 15px; margin: 0 0 16px;">
              Please find attached the employee timesheet for <strong>Week of ${weekLabel}</strong>.
            </p>
            <p style="color: #6b7280; font-size: 13px; margin: 0;">
              This report was generated automatically by TradeFlow. Forward to your CPA as needed.
            </p>
          </div>
        </div>
      `,
      attachments: [
        {
          filename: fileName,
          content: pdfBase64,
          content_type: 'application/pdf',
        }
      ]
    }

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify(emailPayload),
    })

    const result = await res.json()

    if (!res.ok) {
      throw new Error(result.message || 'Resend API error')
    }

    return new Response(JSON.stringify({ success: true, id: result.id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500
    })
  }
})
