# Stripe Online Payments Setup Guide

Customers can now pay invoices via **credit card or ACH bank transfer** directly from the SMS or email link.

---

## How It Works

1. Customer receives SMS or email → clicks the invoice link
2. `InvoiceView` page shows a green **"💳 Pay $X.XX Now"** button
3. Clicking it calls the `create-checkout-session` edge function → redirects to Stripe's hosted checkout
4. Customer pays with card or bank account (ACH)
5. Stripe fires a webhook → `stripe-webhook` edge function marks the invoice as paid in the database
6. Customer lands on `/invoice/pay-success` confirmation page

---

## Step 1: Create a Stripe Account

1. Go to [stripe.com](https://stripe.com) and create an account
2. Complete your business verification (required to receive payouts)
3. Note your **Publishable key** and **Secret key** from: Dashboard → Developers → API Keys

---

## Step 2: Enable ACH Payments in Stripe

1. Stripe Dashboard → Settings → Payment methods
2. Enable **"US Bank Account (ACH)"** 
3. ACH requires completing Stripe's identity verification first

---

## Step 3: Add Environment Variables to Supabase

Go to your **Supabase Dashboard → Edge Functions → Manage secrets** and add:

```
STRIPE_SECRET_KEY = sk_live_xxxxxxxxxxxxxxxx
STRIPE_WEBHOOK_SECRET = whsec_xxxxxxxxxxxxxxxx   (added in Step 4)
```

Use `sk_test_...` for testing first, then switch to `sk_live_...` for production.

---

## Step 4: Deploy the Edge Functions

From the `timeclock-mobile` or root directory:

```bash
cd estimator-react

# Deploy both functions
supabase functions deploy create-checkout-session
supabase functions deploy stripe-webhook
```

Or via the Supabase Dashboard → Edge Functions → Deploy.

---

## Step 5: Register the Webhook in Stripe

1. Stripe Dashboard → Developers → Webhooks → **Add endpoint**
2. Endpoint URL:
   ```
   https://<YOUR-SUPABASE-PROJECT-REF>.supabase.co/functions/v1/stripe-webhook
   ```
3. Select these events to listen for:
   - `checkout.session.completed`
   - `payment_intent.succeeded`
4. Copy the **Signing secret** (starts with `whsec_`) and add it to Supabase secrets as `STRIPE_WEBHOOK_SECRET`

---

## Step 6: Run the SQL Migration

In **Supabase Dashboard → SQL Editor**, run the contents of `SETUP_STRIPE_PAYMENTS.sql`:

```sql
ALTER TABLE invoices 
  ADD COLUMN IF NOT EXISTS stripe_payment_intent_id TEXT,
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;
```

---

## Step 7: Test It

1. Create a quick invoice from the mobile app
2. Email or SMS it to yourself
3. Click the invoice link
4. Click **"💳 Pay Now"**
5. Use Stripe test card: `4242 4242 4242 4242` (any future expiry, any CVC)
6. Confirm the invoice status updates to "paid" in the database

For ACH testing, use Stripe's test bank account numbers from their docs.

---

## Payment Flow Summary

| Payment Method | Settlement Time | Invoice Updates |
|---------------|----------------|-----------------|
| Credit Card   | Immediate       | Instantly marked "paid" |
| ACH/Bank Transfer | 2–5 business days | Set to "payment_pending" then "paid" when funds clear |

---

## Stripe Fees (standard)

- Credit card: **2.9% + $0.30** per transaction
- ACH: **0.8%** capped at **$5.00** per transaction
- ACH is significantly cheaper for large invoices!

---

## Files Created/Modified

| File | Purpose |
|------|---------|
| `supabase/functions/create-checkout-session/index.ts` | Creates Stripe Checkout session |
| `supabase/functions/stripe-webhook/index.ts` | Handles Stripe payment confirmation |
| `src/pages/InvoiceView.jsx` | Added "Pay Now" button |
| `src/pages/InvoicePaySuccess.jsx` | Payment confirmation page |
| `src/App.jsx` | Added `/invoice/pay-success` route |
| `supabase/functions/send-invoice/index.ts` | Added "Pay Invoice Online" button in email |
| `SETUP_STRIPE_PAYMENTS.sql` | DB migration for new columns |
