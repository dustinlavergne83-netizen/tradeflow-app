// Creates a Clover Ecommerce charge for an invoice and marks it as paid.
// Requires CLOVER_PRIVATE_KEY set in Supabase project secrets.
import { corsHeaders } from '../_shared/cors.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const CLOVER_PRIVATE_KEY = Deno.env.get('CLOVER_PRIVATE_KEY')
    if (!CLOVER_PRIVATE_KEY) throw new Error('CLOVER_PRIVATE_KEY is not configured')

    const { invoiceId, token } = await req.json()
    if (!invoiceId) throw new Error('invoiceId is required')
    if (!token)     throw new Error('card token is required')

    // Connect to Supabase
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Fetch invoice
    const { data: invoice, error } = await supabase
      .from('invoices')
      .select('*')
      .eq('id', invoiceId)
      .single()

    if (error || !invoice) throw new Error('Invoice not found')

    // Calculate balance due
    let balanceDue = Number(invoice.balance_due ?? invoice.total ?? invoice.subtotal ?? 0)

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
        const amountPaid     = Number(invoice.amount_paid || 0)
        balanceDue = itemsTotal - depositReceived - amountPaid
      }
    }

    if (balanceDue <= 0) {
      return new Response(
        JSON.stringify({ error: 'This invoice has already been paid.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    const amountCents = Math.round(balanceDue * 100)
    const description  = `Invoice #${invoice.invoice_number || invoiceId} — ${invoice.customer_name || 'Customer'}`

    // ── Clover Ecommerce charge ──────────────────────────────────────────────
    const chargeRes = await fetch('https://scl.clover.com/v1/charges', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CLOVER_PRIVATE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount:      amountCents,
        currency:    'usd',
        source:      token,
        description,
        capture:     true,
      }),
    })

    const chargeData = await chargeRes.json()

    if (!chargeRes.ok) {
      console.error('Clover API error:', JSON.stringify(chargeData))
      const errMsg =
        chargeData?.message ||
        chargeData?.error?.message ||
        chargeData?.error ||
        'Clover charge failed'
      throw new Error(errMsg)
    }

    // Clover marks a charge as paid when status === 'succeeded' or paid === true
    if (chargeData.status !== 'succeeded' && !chargeData.paid) {
      throw new Error(`Payment not completed. Status: ${chargeData.status ?? 'unknown'}`)
    }

    // ── Mark invoice as paid in Supabase ─────────────────────────────────────
    const { error: updateError } = await supabase
      .from('invoices')
      .update({
        status:           'paid',
        amount_paid:      balanceDue,
        balance_due:      0,
        clover_charge_id: chargeData.id,
        paid_at:          new Date().toISOString(),
      })
      .eq('id', invoiceId)

    if (updateError) {
      console.error('Failed to update invoice to paid:', updateError)
      // Charge succeeded — log but don't fail the response
    } else {
      console.log(`Invoice ${invoiceId} marked paid ($${balanceDue}) via Clover charge ${chargeData.id}`)
    }

    return new Response(
      JSON.stringify({ success: true, chargeId: chargeData.id, amount: balanceDue }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (err: any) {
    console.error('create-clover-charge error:', err)
    return new Response(
      JSON.stringify({ error: err.message || String(err) }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
