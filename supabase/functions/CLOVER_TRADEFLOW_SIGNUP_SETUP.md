# 🔧 TradeFlow Clover Signup Integration — Setup Guide

## What Was Built

New customers signing up at **tradeflowllc.com/get-started** now go through a 2-step flow:
1. **Step 1** — Company info (name, portal URL, contact details, trade type)
2. **Step 2** — Card entry via Clover (secure iframe) → card stored on file, **no charge today**

After 14 days, the `bill-trial-conversions` edge function charges their card automatically.

**Pricing:** $49/mo for up to 5 employees · +$5/employee after that

---

## 🚀 One-Time Setup Steps

### Step 1 — Run the SQL Migration

In your **TradeFlow Supabase dashboard** → SQL Editor, run:

```
supabase/migrations/20260707_add_clover_subscription_columns.sql
```

This adds these columns to the `companies` table:
- `clover_customer_id` — Clover's stored customer ID
- `card_brand`, `card_last4` — for displaying "Visa ···· 4242"
- `last_charged_at`, `last_charge_id`, `last_charge_amount`
- `next_billing_at`, `last_billing_error`, `last_billing_attempt`

---

### Step 2 — Add the Clover Secret to Supabase

In your **TradeFlow Supabase dashboard** → Settings → Edge Functions → Secrets:

Add this secret:
```
Name:  CLOVER_TF_PRIVATE_KEY
Value: d3a09431-fce7-9ca4-69e6-5496d7c37809
```

> ⚠️ This is the TradeFlow Clover private key — DIFFERENT from DML's `CLOVER_PRIVATE_KEY`.
> Do NOT mix them up. The existing DML billing key stays as-is.

---

### Step 3 — Deploy the Two New Edge Functions

From a terminal in the `dml` folder:

```bash
supabase functions deploy save-card-for-trial
supabase functions deploy bill-trial-conversions
```

Or from the Supabase dashboard → Edge Functions → deploy each one.

---

### Step 4 — Update the Website's .env

In `c:/Users/Tradeflow/website/.env`, make sure all values are filled in:

```env
VITE_SUPABASE_URL=your_tradeflow_supabase_url
VITE_SUPABASE_ANON_KEY=your_tradeflow_supabase_anon_key
VITE_APP_URL=https://app.tradeflowllc.com
VITE_CLOVER_PUBLIC_KEY=a1e28045a4efdbb20d7ddddabdcc324f
```

If deploying to Vercel, add these same 4 variables in the Vercel project → Settings → Environment Variables.

---

### Step 5 — Deploy the Website

```bash
cd C:/Users/Tradeflow/website
npm run build
```

Then push/deploy to Vercel (or however you currently deploy the website).

---

## ⚙️ Auto-Billing Setup (Daily Cron)

To automatically bill expired trials every day, set up a Supabase cron job.

In **Supabase dashboard** → SQL Editor, run:

```sql
-- Enable the pg_cron extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule daily billing at 9:00 AM UTC
SELECT cron.schedule(
  'bill-expired-trials',
  '0 9 * * *',
  $$
  SELECT net.http_post(
    url := 'https://YOUR_SUPABASE_PROJECT_REF.supabase.co/functions/v1/bill-trial-conversions',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer YOUR_SUPABASE_ANON_KEY'
    ),
    body := '{}'::jsonb
  );
  $$
);
```

Replace `YOUR_SUPABASE_PROJECT_REF` and `YOUR_SUPABASE_ANON_KEY` with your TradeFlow Supabase values.

---

## 🧪 Testing

### Test the signup form
1. Go to `tradeflowllc.com/get-started` (or `localhost:5173/get-started`)
2. Fill in company info → click "Continue to Payment"
3. Enter a test card (use your real card or a Clover test card)
4. Click "Start Free Trial"
5. Check your Clover dashboard — a customer should appear with card stored (no charge)
6. Check Supabase → `companies` table — new row with `clover_customer_id` filled in

### Manually bill a single company (for testing)
POST to the edge function with a company ID:

```bash
curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/bill-trial-conversions \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"companyId": "the-company-uuid-here"}'
```

---

## 📋 Monitoring

**View active trials (not yet billed):**
```sql
SELECT name, slug, trial_ends_at, clover_customer_id, card_brand, card_last4
FROM companies
WHERE subscription_status = 'trial'
ORDER BY trial_ends_at;
```

**View paid/active subscriptions:**
```sql
SELECT name, slug, subscription_status, last_charged_at, last_charge_amount, next_billing_at
FROM companies
WHERE subscription_status = 'active'
ORDER BY last_charged_at DESC;
```

**View failed billings:**
```sql
SELECT name, slug, subscription_status, last_billing_error, last_billing_attempt
FROM companies
WHERE subscription_status = 'past_due'
ORDER BY last_billing_attempt DESC;
```

---

## 💡 How It Works (Full Flow)

```
Customer visits tradeflowllc.com/get-started
    ↓
Step 1: Fills company info → clicks "Continue to Payment"
    ↓ (validates + checks slug availability)
Step 2: Enters card into Clover iframe
    ↓
Clover SDK tokenizes card (card data never touches your server)
    ↓
Website calls → Supabase Edge Function: save-card-for-trial
    ├── Creates Clover customer (stores card — $0 charge)
    ├── Creates Supabase auth user
    ├── Creates company (subscription_status: "trial", trial_ends_at: +14 days)
    └── Creates employee (role: "admin")
    ↓
Success → Auto sign-in → redirect to app.tradeflowllc.com?welcome=1

... 14 days later ...

Daily cron calls → bill-trial-conversions edge function
    ├── Finds all companies where trial_ends_at <= now AND status = "trial"
    ├── Counts active employees per company
    ├── Calculates amount ($49 + $5 × extra employees)
    ├── Charges via Clover using stored clover_customer_id
    └── Updates subscription_status: "active"
```
