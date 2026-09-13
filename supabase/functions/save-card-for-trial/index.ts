// save-card-for-trial/index.ts
// ─────────────────────────────────────────────────────────────────────────────
// Called from the TradeFlow public website /get-started signup page.
// Uses the TRADEFLOW Clover account (CLOVER_TF_PRIVATE_KEY) — NOT the DML key.
//
// Flow:
//   1. Validate slug isn't taken
//   2. Create a Clover customer (stores card on file — $0 charge today)
//   3. Create Supabase auth user (auto-confirmed)
//   4. Create company record (trial, 14 days) + employee record (admin)
//   5. Return success
// ─────────────────────────────────────────────────────────────────────────────
import { corsHeaders } from '../_shared/cors.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// TradeFlow Clover eCommerce private key (separate from DML's CLOVER_PRIVATE_KEY)
const CLOVER_TF_PRIVATE_KEY = Deno.env.get('CLOVER_TF_PRIVATE_KEY') ?? ''
const CLOVER_API = 'https://scl.clover.com/v1'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    if (!CLOVER_TF_PRIVATE_KEY) {
      throw new Error('TradeFlow payment system is not configured. Contact support.')
    }

    const {
      cardToken,
      companyName,
      slug,
      firstName,
      lastName,
      email,
      password,
      phone,
      tradeType,
    } = await req.json()

    // ── Validate required fields ──────────────────────────────────────────
    if (!cardToken)          throw new Error('Card token is required.')
    if (!companyName?.trim()) throw new Error('Company name is required.')
    if (!slug?.trim() || slug.length < 3) throw new Error('Portal URL is too short.')
    if (!email?.trim())      throw new Error('Email is required.')
    if (!password || password.length < 8) throw new Error('Password must be at least 8 characters.')

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // ── 1. Check slug availability ────────────────────────────────────────
    const { data: existingCo } = await supabase
      .from('companies')
      .select('id')
      .eq('slug', slug.trim())
      .maybeSingle()

    if (existingCo) {
      return new Response(
        JSON.stringify({ success: false, error: 'That portal URL is already taken. Please choose a different one.' }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ── 2. Create Clover customer (stores card — NO charge today) ─────────
    const cloverRes = await fetch(`${CLOVER_API}/customers`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CLOVER_TF_PRIVATE_KEY}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        source: cardToken,
        email: email.toLowerCase().trim(),
        name: `${firstName ?? ''} ${lastName ?? ''}`.trim() || undefined,
      }),
    })

    if (!cloverRes.ok) {
      const errText = await cloverRes.text()
      let errMsg = 'Failed to save payment method. Please check your card details.'
      try {
        const errJson = JSON.parse(errText)
        errMsg = errJson?.error?.message || errJson?.message || errMsg
      } catch (_) { /* ignore */ }
      console.error('Clover customer create error:', errText)
      throw new Error(errMsg)
    }

    const cloverCustomer = await cloverRes.json()
    const cloverCustomerId: string = cloverCustomer.id ?? ''
    const firstCard = cloverCustomer.sources?.data?.[0]
    const cardBrand: string = firstCard?.brand ?? ''
    const cardLast4: string = firstCard?.last4 ?? ''

    // ── 3. Create Supabase auth user ──────────────────────────────────────
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: email.toLowerCase().trim(),
      password,
      email_confirm: true,   // auto-confirm — card on file proves intent
      user_metadata: {
        first_name: firstName?.trim() ?? '',
        last_name: lastName?.trim() ?? '',
      },
    })

    if (authError) {
      if (authError.message?.toLowerCase().includes('already')) {
        throw new Error('An account with this email already exists. Please sign in instead.')
      }
      throw authError
    }

    const userId = authData.user?.id
    if (!userId) throw new Error('Failed to create user account.')

    // ── 4. Create company record (14-day trial) ───────────────────────────
    const trialEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()

    const { data: company, error: coError } = await supabase
      .from('companies')
      .insert({
        name: companyName.trim(),
        slug: slug.trim(),
        primary_color: '#fc6b04',
        subscription_status: 'trial',
        subscription_tier: 'basic',
        trial_ends_at: trialEndsAt,
        clover_customer_id: cloverCustomerId,
        card_brand: cardBrand,
        card_last4: cardLast4,
      })
      .select()
      .single()

    if (coError) {
      await supabase.auth.admin.deleteUser(userId).catch(() => {})
      throw coError
    }

    // ── 5. Create employee record (admin role) ────────────────────────────
    const { error: empError } = await supabase
      .from('employees')
      .insert({
        user_id: userId,
        company_id: company.id,
        email: email.toLowerCase().trim(),
        first_name: firstName?.trim() ?? '',
        last_name: lastName?.trim() ?? '',
        phone: phone ?? null,
        role: 'admin',
        is_active: true,
      })

    if (empError) {
      await supabase.from('companies').delete().eq('id', company.id).catch(() => {})
      await supabase.auth.admin.deleteUser(userId).catch(() => {})
      throw empError
    }

    // ── 6. Tag user with company_id for RLS ──────────────────────────────
    await supabase.auth.admin.updateUserById(userId, {
      user_metadata: {
        company_id: company.id,
        first_name: firstName?.trim() ?? '',
        last_name: lastName?.trim() ?? '',
      },
    })

    console.log(`New TradeFlow trial: ${company.slug} | ${email} | Clover customer: ${cloverCustomerId}`)

    return new Response(
      JSON.stringify({
        success: true,
        slug: company.slug,
        trialEndsAt,
        cardLast4,
        cardBrand,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (err: any) {
    console.error('save-card-for-trial error:', err)
    return new Response(
      JSON.stringify({ success: false, error: err?.message || 'An unexpected error occurred.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
