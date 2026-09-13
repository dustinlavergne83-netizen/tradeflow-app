-- ─────────────────────────────────────────────────────────────────────────────
-- ADD CLOVER SUBSCRIPTION COLUMNS TO COMPANIES TABLE
-- Run this in your TradeFlow Supabase dashboard → SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────
-- These columns support the new Clover-powered signup & auto-billing system.

ALTER TABLE companies
  -- Clover customer ID (used to charge card on file after trial)
  ADD COLUMN IF NOT EXISTS clover_customer_id     text,

  -- Card display info (e.g. "Visa ending in 4242")
  ADD COLUMN IF NOT EXISTS card_brand             text,
  ADD COLUMN IF NOT EXISTS card_last4             text,

  -- Billing tracking
  ADD COLUMN IF NOT EXISTS last_charged_at        timestamptz,
  ADD COLUMN IF NOT EXISTS last_charge_id         text,
  ADD COLUMN IF NOT EXISTS last_charge_amount     integer,   -- in cents
  ADD COLUMN IF NOT EXISTS next_billing_at        timestamptz,
  ADD COLUMN IF NOT EXISTS last_billing_error     text,
  ADD COLUMN IF NOT EXISTS last_billing_attempt   timestamptz;

-- Verify columns were added
SELECT
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'companies'
  AND column_name IN (
    'clover_customer_id', 'card_brand', 'card_last4',
    'last_charged_at', 'last_charge_id', 'last_charge_amount',
    'next_billing_at', 'last_billing_error', 'last_billing_attempt'
  )
ORDER BY column_name;
