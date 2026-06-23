# Clover Payment Integration Setup

This document walks you through the 4 steps needed to activate Clover online payments on your invoices.

---

## Step 1 — Get Your Clover API Keys

1. Log into **dashboard.clover.com**
2. Navigate to **Account & Setup → Ecommerce API Keys**
3. Copy both keys:
   - **Public Key** — starts with `pk_live_...` (safe for browser use)
   - **Private Key** — starts with `pk_prod_...` or similar (keep secret)

> If you don't see "Ecommerce API Keys" in your dashboard, your Clover account may need Ecommerce enabled. Contact Clover support or check Account → Pricing Plan.

---

## Step 2 — Add the Public Key to Your App (.env file)

Open (or create) the file `estimator-react/.env` and add:

```
VITE_CLOVER_PUBLIC_KEY=pk_live_YOUR_PUBLIC_KEY_HERE
```

Then rebuild/redeploy your app so the new env variable is picked up.

---

## Step 3 — Add the Private Key to Supabase Secrets

1. Go to your **Supabase Dashboard** → **Project Settings → Edge Functions → Secrets**
2. Click **New Secret** and add:
   - **Name:** `CLOVER_PRIVATE_KEY`
   - **Value:** your private key from Step 1

---

## Step 4 — Deploy the New Edge Function

Run this command from the `estimator-react` folder:

```bash
npx supabase functions deploy create-clover-charge
```

Or deploy all functions at once:

```bash
npx supabase functions deploy
```

---

## Step 5 — Run the Database Migration

In your **Supabase Dashboard → SQL Editor**, run the contents of:

```
supabase/migrations/add_clover_charge_id.sql
```

This adds a `clover_charge_id` column to the `invoices` table so each payment is traceable back to Clover.

---

## How It Works (Customer Flow)

1. Customer opens invoice link (same URL as before)
2. Sees **"💳 Pay $X.XX by Card"** button (powered by Clover instead of Square)
3. Clicks it → a secure card form expands **right on the invoice page** (no redirect away)
4. Enters card number, expiry, CVV
5. Hits **"✅ Pay $X.XX"**
6. Card is tokenized by Clover (PCI compliant — raw card data never touches your server)
7. Your backend charges the card via Clover's Ecommerce API
8. Invoice is instantly marked **Paid** in your database
9. Page shows **✅ Paid in Full — Thank you!**

---

## Troubleshooting

| Problem | Fix |
|---|---|
| "Clover public key is not configured" | Check `VITE_CLOVER_PUBLIC_KEY` in your `.env` file and redeploy |
| "CLOVER_PRIVATE_KEY is not configured" | Add the secret in Supabase Dashboard → Edge Functions → Secrets |
| Card form doesn't appear | Check browser console for errors; ensure your domain is whitelisted in Clover dashboard |
| "Clover charge failed" | Verify private key is correct and Ecommerce API is enabled on your Clover account |

---

## Files Changed

| File | What It Does |
|---|---|
| `src/pages/InvoiceView.jsx` | Replaced Square button with embedded Clover payment form |
| `supabase/functions/create-clover-charge/index.ts` | New backend function — charges card via Clover Ecommerce API and marks invoice paid |
| `supabase/migrations/add_clover_charge_id.sql` | Adds `clover_charge_id` column to invoices table |
| `.env` (you create/edit) | Holds your Clover public key |
