// Square webhook handler — marks invoices as paid when payment completes.
// Register this URL in Square Developer Console → Webhooks:
//   https://hyhjxdgdetdqoyoscflu.supabase.co/functions/v1/square-webhook
// Events to subscribe: payment.completed
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SQUARE_WEBHOOK_SIGNATURE_KEY = Deno.env.get('SQUARE_WEBHOOK_SIGNATURE_KEY') ?? ''
const SQUARE_ACCESS_TOKEN          = Deno.env.get('SQUARE_ACCESS_TOKEN') ?? ''

// Square HMAC-SHA256 signature verification
async function verifySquareSignature(
  body: string,
  signatureHeader: string,
  webhookUrl: string,
  signatureKey: string
): Promise<boolean> {
  try {
    // Square signature = HMAC-SHA256(webhookUrl + body, signatureKey) → base64
    const payload = webhookUrl + body
    const keyData = new TextEncoder().encode(signatureKey)
    const msgData = new TextEncoder().encode(payload)

    const cryptoKey = await crypto.subtle.importKey(
      'raw', keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false, ['sign']
    )
    const sigBuffer = await crypto.subtle.sign('HMAC', cryptoKey, msgData)
    const computed  = btoa(String.fromCharCode(...new Uint8Array(sigBuffer)))

    return computed === signatureHeader
  } catch {
    return false
  }
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 })
  }

  const body      = await req.text()
  const sigHeader = req.headers.get('x-square-hmacsha256-signature') ?? ''
  const webhookUrl = `https://hyhjxdgdetdqoyoscflu.supabase.co/functions/v1/square-webhook`

  // Verify webhook signature if key is configured
  if (SQUARE_WEBHOOK_SIGNATURE_KEY) {
    const valid = await verifySquareSignature(body, sigHeader, webhookUrl, SQUARE_WEBHOOK_SIGNATURE_KEY)
    if (!valid) {
      console.error('Square webhook signature verification failed')
      return new Response('Signature verification failed', { status: 400 })
    }
  }

  let event: any
  try {
    event = JSON.parse(body)
  } catch {
    return new Response('Invalid JSON', { status: 400 })
  }

  console.log('Square webhook event type:', event.type)

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  try {
    // payment.updated fires when a payment changes status.
    // We only act when status === 'COMPLETED' (approved/captured).
    if (event.type === 'payment.updated') {
      const payment = event.data?.object?.payment
      if (!payment) {
        console.log('No payment object in event, skipping.')
        return new Response(JSON.stringify({ received: true }), { status: 200 })
      }

      // Only process fully completed payments
      if (payment.status !== 'COMPLETED') {
        console.log(`Payment status is ${payment.status}, not COMPLETED — skipping.`)
        return new Response(JSON.stringify({ received: true }), { status: 200 })
      }

      const orderId    = payment.order_id
      const amountPaid = (payment.amount_money?.amount || 0) / 100

      if (!orderId) {
        console.log('No order_id on payment, skipping.')
        return new Response(JSON.stringify({ received: true }), { status: 200 })
      }

      // Look up the order to get the reference_id (= our invoiceId)
      const orderRes = await fetch(`https://connect.squareup.com/v2/orders/${orderId}`, {
        headers: {
          'Authorization': `Bearer ${SQUARE_ACCESS_TOKEN}`,
          'Square-Version': '2024-01-18',
        },
      })
      const orderData = await orderRes.json()
      const invoiceId = orderData?.order?.reference_id

      if (!invoiceId) {
        console.log('No reference_id (invoiceId) found on order, skipping.')
        return new Response(JSON.stringify({ received: true }), { status: 200 })
      }

      // Mark invoice as paid
      const { error } = await supabase
        .from('invoices')
        .update({
          status: 'paid',
          amount_paid: amountPaid,
          balance_due: 0,
          square_payment_id: payment.id,
          paid_at: new Date().toISOString(),
        })
        .eq('id', invoiceId)

      if (error) {
        console.error('Failed to mark invoice paid:', error)
      } else {
        console.log(`Invoice ${invoiceId} marked as paid ($${amountPaid}) via Square payment ${payment.id}`)
      }
    }
  } catch (err) {
    console.error('Square webhook handler error:', err)
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 })
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { 'Content-Type': 'application/json' },
    status: 200,
  })
})
