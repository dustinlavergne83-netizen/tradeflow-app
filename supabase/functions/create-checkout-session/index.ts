// Creates a Stripe Checkout Session for an invoice.
// Supports both Credit Card and ACH (us_bank_account) payment methods.
import { corsHeaders } from '../_shared/cors.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY')
    if (!STRIPE_SECRET_KEY) throw new Error('STRIPE_SECRET_KEY is not configured')

    const { invoiceId, siteUrl, ccFee = 0, paymentType = 'card' } = await req.json()
    if (!invoiceId) throw new Error('invoiceId is required')

    const baseUrl = (siteUrl || 'https://estimator.dmlelectrical.com').replace(/\/$/, '')

    // Fetch invoice from Supabase using service role (bypasses RLS)
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { data: invoice, error } = await supabase
      .from('invoices')
      .select('*')
      .eq('id', invoiceId)
      .single()

    if (error || !invoice) throw new Error('Invoice not found')

    // Calculate balance due — prefer DB field, fall back to calculating from items
    let balanceDue = Number(invoice.balance_due ?? invoice.total ?? invoice.subtotal ?? 0)

    // If DB balance is 0 or null, recalculate from invoice items
    if (balanceDue <= 0) {
      const { data: items } = await supabase
        .from('invoice_items')
        .select('total, markup_percentage')
        .eq('invoice_id', invoiceId)

      if (items && items.length > 0) {
        const itemsTotal = items.reduce((sum: number, item: any) => {
          const mp = item.markup_percentage || 0
          return sum + (item.total || 0) * (1 + mp / 100)
        }, 0)
        const depositReceived = Number(invoice.deposit_received || 0)
        const amountPaid = Number(invoice.amount_paid || 0)
        balanceDue = itemsTotal - depositReceived - amountPaid
        console.log(`Calculated balance from items: ${itemsTotal} - ${depositReceived} - ${amountPaid} = ${balanceDue}`)
      }
    }

    if (balanceDue <= 0) {
      return new Response(
        JSON.stringify({ error: 'This invoice has already been paid.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    const balanceCents = Math.round(balanceDue * 100)
    const feeCents = Math.round(Number(ccFee || 0) * 100)
    const invoiceLabel = `Invoice #${invoice.invoice_number || invoiceId}`
    const projectDesc = invoice.project_name || 'Electrical Services'

    // Build Stripe Checkout Session params
    const params = new URLSearchParams()
    params.append('mode', 'payment')

    // Payment method type — card or ACH bank transfer
    if (paymentType === 'ach') {
      params.append('payment_method_types[]', 'us_bank_account')
    } else {
      params.append('payment_method_types[]', 'card')
    }

    // Line item 1: Invoice balance
    params.append('line_items[0][price_data][currency]', 'usd')
    params.append('line_items[0][price_data][unit_amount]', String(balanceCents))
    params.append('line_items[0][price_data][product_data][name]', invoiceLabel)
    params.append('line_items[0][price_data][product_data][description]', projectDesc)
    params.append('line_items[0][quantity]', '1')

    // Line item 2: CC processing fee (only when card + fee > 0)
    if (feeCents > 0 && paymentType === 'card') {
      params.append('line_items[1][price_data][currency]', 'usd')
      params.append('line_items[1][price_data][unit_amount]', String(feeCents))
      params.append('line_items[1][price_data][product_data][name]', 'Credit Card Processing Fee (3%)')
      params.append('line_items[1][price_data][product_data][description]', 'Convenience fee for paying by credit/debit card')
      params.append('line_items[1][quantity]', '1')
    }

    // Pre-fill customer email if available
    if (invoice.customer_email) {
      params.append('customer_email', invoice.customer_email)
    }

    // Redirect URLs
    params.append('success_url', `${baseUrl}/invoice/pay-success?invoiceId=${invoiceId}&session_id={CHECKOUT_SESSION_ID}`)
    params.append('cancel_url', `${baseUrl}/invoice/view?invoiceId=${invoiceId}`)

    // Metadata so the webhook can identify which invoice to mark paid
    params.append('metadata[invoiceId]', invoiceId)
    params.append('metadata[invoiceNumber]', invoice.invoice_number || '')
    params.append('payment_intent_data[metadata][invoiceId]', invoiceId)
    params.append('payment_intent_data[description]', `${invoiceLabel} - ${invoice.customer_name || ''}`)

    // Submit to Stripe
    const stripeRes = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Stripe-Version': '2024-06-20',
      },
      body: params.toString(),
    })

    const session = await stripeRes.json()

    if (!stripeRes.ok) {
      console.error('Stripe error:', JSON.stringify(session))
      throw new Error(session?.error?.message || 'Stripe checkout session creation failed')
    }

    return new Response(
      JSON.stringify({ url: session.url, sessionId: session.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err: any) {
    console.error('create-checkout-session error:', err)
    return new Response(
      JSON.stringify({ error: err.message || String(err) }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
