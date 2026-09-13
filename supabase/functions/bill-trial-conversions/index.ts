// bill-trial-conversions/index.ts
// ─────────────────────────────────────────────────────────────────────────────
// Finds all companies whose 14-day trial has expired and charges their
// stored Clover card using the TRADEFLOW Clover account (CLOVER_TF_PRIVATE_KEY).
//
// Pricing: $49/mo base (up to 5 employees) + $5/employee after that.
//
// Run this daily via Supabase cron or manually from the dashboard.
// POST with no body — it self-discovers all expired trials.
//
// Can also be called with { companyId } to manually bill a single company.
// ─────────────────────────────────────────────────────────────────────────────
import { corsHeaders } from '../_shared/cors.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CLOVER_TF_PRIVATE_KEY = Deno.env.get('CLOVER_TF_PRIVATE_KEY') ?? ''
const CLOVER_API = 'https://scl.clover.com/v1'

const BASE_PRICE_CENTS = 4900       // $49.00
const PRICE_PER_EXTRA_CENTS = 500   // $5.00 per employee after 5
const INCLUDED_EMPLOYEES = 5

function calcAmountCents(employeeCount: number): number {
  const extra = Math.max(0, employeeCount - INCLUDED_EMPLOYEES)
  return BASE_PRICE_CENTS + (extra * PRICE_PER_EXTRA_CENTS)
}

function formatDollars(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    if (!CLOVER_TF_PRIVATE_KEY) {
      throw new Error('CLOVER_TF_PRIVATE_KEY is not configured in Supabase secrets.')
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Parse optional body — can target a single company or run for all expired
    let singleCompanyId: string | null = null
    try {
      const body = await req.json().catch(() => ({}))
      singleCompanyId = body?.companyId ?? null
    } catch (_) { /* no body is fine */ }

    // ── Find companies to bill ────────────────────────────────────────────
    let query = supabase
      .from('companies')
      .select('id, name, slug, clover_customer_id, card_last4, card_brand')
      .eq('subscription_status', 'trial')
      .not('clover_customer_id', 'is', null)

    if (singleCompanyId) {
      // Manual single-company billing
      query = query.eq('id', singleCompanyId)
    } else {
      // Automatic: only those whose trial has expired
      query = query.lte('trial_ends_at', new Date().toISOString())
    }

    const { data: companies, error: fetchError } = await query

    if (fetchError) throw fetchError
    if (!companies || companies.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No trials to convert.', billed: 0 }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const results: any[] = []

    // ── Process each company ──────────────────────────────────────────────
    for (const company of companies) {
      const companyResult: any = {
        companyId: company.id,
        slug: company.slug,
        name: company.name,
        status: 'pending',
      }

      try {
        // Count active employees for this company
        const { count: empCount } = await supabase
          .from('employees')
          .select('*', { count: 'exact', head: true })
          .eq('company_id', company.id)
          .eq('is_active', true)

        const employeeCount = empCount ?? 1
        const amountCents = calcAmountCents(employeeCount)
        const description = `TradeFlow Pro — ${company.name} — ${employeeCount} employee${employeeCount !== 1 ? 's' : ''}`

        companyResult.employees = employeeCount
        companyResult.amountCents = amountCents
        companyResult.amount = formatDollars(amountCents)

        // ── Charge via Clover ─────────────────────────────────────────────
        const chargeRes = await fetch(`${CLOVER_API}/charges`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${CLOVER_TF_PRIVATE_KEY}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          body: JSON.stringify({
            amount: amountCents,
            currency: 'usd',
            customer: company.clover_customer_id,
            description,
            capture: true,
          }),
        })

        const chargeData = await chargeRes.json()

        if (!chargeRes.ok) {
          const errMsg = chargeData?.error?.message || chargeData?.message || 'Charge failed'
          console.error(`Billing failed for ${company.slug}:`, errMsg)

          // Mark as past_due so we know to retry
          await supabase
            .from('companies')
            .update({
              subscription_status: 'past_due',
              last_billing_error: errMsg,
              last_billing_attempt: new Date().toISOString(),
            })
            .eq('id', company.id)

          companyResult.status = 'failed'
          companyResult.error = errMsg
          results.push(companyResult)
          continue
        }

        // Charge succeeded
        const chargeId = chargeData.id ?? ''

        // ── Update company to active subscription ─────────────────────────
        const nextBillingAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()

        await supabase
          .from('companies')
          .update({
            subscription_status: 'active',
            subscription_tier: 'pro',
            last_charged_at: new Date().toISOString(),
            last_charge_id: chargeId,
            last_charge_amount: amountCents,
            next_billing_at: nextBillingAt,
            last_billing_error: null,
          })
          .eq('id', company.id)

        console.log(`✅ Billed ${company.slug}: ${formatDollars(amountCents)} (${employeeCount} employees) — Clover charge ${chargeId}`)

        companyResult.status = 'success'
        companyResult.chargeId = chargeId
        results.push(companyResult)

      } catch (companyErr: any) {
        console.error(`Error billing company ${company.slug}:`, companyErr)
        companyResult.status = 'error'
        companyResult.error = companyErr?.message ?? 'Unknown error'
        results.push(companyResult)
      }
    }

    const successCount = results.filter(r => r.status === 'success').length
    const failedCount  = results.filter(r => r.status !== 'success').length

    return new Response(
      JSON.stringify({
        success: true,
        message: `Processed ${results.length} trial(s): ${successCount} billed, ${failedCount} failed.`,
        billed: successCount,
        failed: failedCount,
        results,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (err: any) {
    console.error('bill-trial-conversions error:', err)
    return new Response(
      JSON.stringify({ success: false, error: err?.message || 'Unexpected error.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
