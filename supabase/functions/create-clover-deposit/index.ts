// Creates a Clover Ecommerce charge for a proposal deposit and marks it as paid.
// Receives: { proposalId, token }
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

    const { proposalId, token } = await req.json()
    if (!proposalId) throw new Error('proposalId is required')
    if (!token)      throw new Error('card token is required')

    // Connect to Supabase
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Fetch proposal
    const { data: proposal, error: propErr } = await supabase
      .from('proposals')
      .select('*')
      .eq('id', proposalId)
      .single()

    if (propErr || !proposal) throw new Error('Proposal not found')
    if (!proposal.deposit_required)  throw new Error('No deposit required on this proposal')
    if (proposal.deposit_paid)       throw new Error('Deposit has already been paid')

    // Calculate deposit amount from percent
    const totalAmount    = Number(proposal.total_amount || 0)
    const depositPercent = Number(proposal.deposit_percent || 0)
    if (depositPercent <= 0) throw new Error('Deposit percentage is not set on this proposal')

    const depositAmount = Math.round(totalAmount * (depositPercent / 100) * 100) / 100
    if (depositAmount <= 0) throw new Error('Deposit amount calculated to zero — check proposal total and percentage')

    const amountCents = Math.round(depositAmount * 100)

    const description = [
      `Deposit (${depositPercent}%) — Proposal`,
      proposal.proposal_number ? ` #${proposal.proposal_number.replace('PROP-', '')}` : '',
      proposal.contractor_name ? ` for ${proposal.contractor_name}` : '',
    ].join('')

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

    if (chargeData.status !== 'succeeded' && !chargeData.paid) {
      throw new Error(`Payment not completed. Status: ${chargeData.status ?? 'unknown'}`)
    }

    // ── Mark proposal deposit as paid ────────────────────────────────────────
    const { error: propUpdateErr } = await supabase
      .from('proposals')
      .update({
        deposit_paid:       true,
        deposit_amount:     depositAmount,
        deposit_paid_at:    new Date().toISOString(),
        deposit_charge_id:  chargeData.id,
      })
      .eq('id', proposalId)

    if (propUpdateErr) {
      // Charge succeeded — log but don't fail
      console.error('Failed to mark proposal deposit as paid:', propUpdateErr)
    } else {
      console.log(`Proposal ${proposalId} deposit paid ($${depositAmount}) via Clover charge ${chargeData.id}`)
    }

    // ── Also create a deposit invoice record for bookkeeping ─────────────────
    try {
      await supabase.from('invoices').insert([{
        company_id:       proposal.company_id,
        project_id:       proposal.project_id,
        customer_name:    proposal.contractor_name,
        invoice_number:   `DEP-${Date.now()}`,
        invoice_date:     new Date().toISOString().split('T')[0],
        status:           'paid',
        subtotal:         depositAmount,
        total:            depositAmount,
        amount_paid:      depositAmount,
        balance_due:      0,
        notes:            `Deposit (${depositPercent}%) on proposal — ${description}`,
        clover_charge_id: chargeData.id,
        paid_at:          new Date().toISOString(),
        source_type:      'proposal_deposit',
        source_id:        proposalId,
      }])
    } catch (invoiceErr) {
      // Non-fatal — deposit is already marked paid on the proposal
      console.error('Could not create deposit invoice record:', invoiceErr)
    }

    return new Response(
      JSON.stringify({ success: true, chargeId: chargeData.id, amount: depositAmount }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (err: any) {
    console.error('create-clover-deposit error:', err)
    return new Response(
      JSON.stringify({ error: err.message || String(err) }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
