// Stripe webhook handler - marks invoices as paid when payment completes.
// Register this URL in your Stripe Dashboard → Webhooks:
//   https://<your-supabase-project>.supabase.co/functions/v1/stripe-webhook
// Events to listen for: checkout.session.completed, payment_intent.succeeded
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const STRIPE_WEBHOOK_SECRET = Deno.env.get('STRIPE_WEBHOOK_SECRET') ?? ''

// Stripe signature verification using Web Crypto API
async function verifyStripeSignature(body: string, header: string, secret: string): Promise<boolean> {
  try {
    const parts = header.split(',')
    const timestamp = parts.find(p => p.startsWith('t='))?.slice(2)
    const sig = parts.find(p => p.startsWith('v1='))?.slice(3)
    if (!timestamp || !sig) return false

    const payload = `${timestamp}.${body}`
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    )
    const signatureBuffer = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload))
    const computed = Array.from(new Uint8Array(signatureBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')

    return computed === sig
  } catch {
    return false
  }
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 })
  }

  const body = await req.text()
  const signature = req.headers.get('stripe-signature') ?? ''

  // Verify webhook authenticity
  if (STRIPE_WEBHOOK_SECRET) {
    const valid = await verifyStripeSignature(body, signature, STRIPE_WEBHOOK_SECRET)
    if (!valid) {
      console.error('Stripe signature verification failed')
      return new Response('Signature verification failed', { status: 400 })
    }
  }

  let event: any
  try {
    event = JSON.parse(body)
  } catch {
    return new Response('Invalid JSON', { status: 400 })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  try {
    // checkout.session.completed fires immediately for card payments
    // and for ACH after the payment is confirmed
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object
      const invoiceId = session.metadata?.invoiceId

      if (!invoiceId) {
        console.log('No invoiceId in session metadata, skipping.')
        return new Response(JSON.stringify({ received: true }), { status: 200 })
      }

      const amountPaid = (session.amount_total || 0) / 100
      const paymentStatus = session.payment_status // 'paid' or 'unpaid' (ACH pending)

      if (paymentStatus === 'paid') {
        // Card payment - funds confirmed immediately
        const { error } = await supabase
          .from('invoices')
          .update({
            status: 'paid',
            amount_paid: amountPaid,
            balance_due: 0,
            stripe_payment_intent_id: session.payment_intent,
            paid_at: new Date().toISOString(),
          })
          .eq('id', invoiceId)

        if (error) console.error('Failed to mark invoice paid:', error)
        else console.log(`Invoice ${invoiceId} marked as paid ($${amountPaid})`)
      } else {
        // ACH - payment initiated but pending bank processing
        const { error } = await supabase
          .from('invoices')
          .update({
            status: 'payment_pending',
            stripe_payment_intent_id: session.payment_intent,
          })
          .eq('id', invoiceId)

        if (error) console.error('Failed to set payment_pending:', error)
        else console.log(`Invoice ${invoiceId} set to payment_pending (ACH initiated)`)
      }
    }

    // payment_intent.succeeded fires when ACH payment clears
    if (event.type === 'payment_intent.succeeded') {
      const pi = event.data.object
      const invoiceId = pi.metadata?.invoiceId

      if (invoiceId) {
        const amountPaid = (pi.amount_received || 0) / 100

        const { error } = await supabase
          .from('invoices')
          .update({
            status: 'paid',
            amount_paid: amountPaid,
            balance_due: 0,
            paid_at: new Date().toISOString(),
          })
          .eq('id', invoiceId)

        if (error) console.error('Failed to mark invoice paid (payment_intent.succeeded):', error)
        else console.log(`Invoice ${invoiceId} marked paid via payment_intent.succeeded ($${amountPaid})`)
      }
    }
  } catch (err) {
    console.error('Webhook handler error:', err)
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 })
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { 'Content-Type': 'application/json' },
    status: 200,
  })
})
