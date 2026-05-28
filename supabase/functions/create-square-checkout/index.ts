// Creates a Square Payment Link for an invoice and returns the checkout URL.
import { corsHeaders } from '../_shared/cors.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const SQUARE_ACCESS_TOKEN = Deno.env.get('SQUARE_ACCESS_TOKEN')
    const SQUARE_LOCATION_ID  = Deno.env.get('SQUARE_LOCATION_ID')

    if (!SQUARE_ACCESS_TOKEN) throw new Error('SQUARE_ACCESS_TOKEN is not configured')
    if (!SQUARE_LOCATION_ID)  throw new Error('SQUARE_LOCATION_ID is not configured')

    const { invoiceId, siteUrl } = await req.json()
    if (!invoiceId) throw new Error('invoiceId is required')

    const baseUrl = (siteUrl || Deno.env.get('SITE_URL') || 'https://tradeflow-app.vercel.app').replace(/\/$/, '')

    // Fetch invoice from Supabase
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
        const amountPaid = Number(invoice.amount_paid || 0)
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
    const invoiceLabel = `Invoice #${invoice.invoice_number || invoiceId}`
    const projectDesc  = invoice.project_name || 'Electrical Services'

    // Build Square Payment Link request
    const body: any = {
      idempotency_key: `invoice-${invoiceId}-${Date.now()}`,
      order: {
        location_id: SQUARE_LOCATION_ID,
        reference_id: invoiceId,           // used by webhook to find the invoice
        line_items: [
          {
            name: invoiceLabel,
            note: projectDesc,
            quantity: '1',
            base_price_money: {
              amount: amountCents,
              currency: 'USD',
            },
          },
        ],
      },
      checkout_options: {
        redirect_url: `${baseUrl}/invoice/pay-success?invoiceId=${invoiceId}`,
        ask_for_shipping_address: false,
      },
    }

    // Pre-fill buyer email if available
    if (invoice.customer_email) {
      body.pre_populated_data = { buyer_email: invoice.customer_email }
    }

    const squareRes = await fetch('https://connect.squareup.com/v2/online-checkout/payment-links', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SQUARE_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
        'Square-Version': '2024-01-18',
      },
      body: JSON.stringify(body),
    })

    const squareData = await squareRes.json()

    if (!squareRes.ok) {
      console.error('Square API error:', JSON.stringify(squareData))
      const errMsg = squareData?.errors?.[0]?.detail || squareData?.errors?.[0]?.code || 'Square checkout creation failed'
      throw new Error(errMsg)
    }

    const checkoutUrl = squareData?.payment_link?.url
    if (!checkoutUrl) throw new Error('No checkout URL returned from Square')

    return new Response(
      JSON.stringify({ url: checkoutUrl, paymentLinkId: squareData.payment_link.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (err: any) {
    console.error('create-square-checkout error:', err)
    return new Response(
      JSON.stringify({ error: err.message || String(err) }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
