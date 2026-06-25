-- ============================================================
-- TradeFlow: Add billing columns to companies table
-- Run this in Supabase SQL Editor
-- ============================================================

-- Add trial + Clover billing columns to companies
ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS trial_ends_at     TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS clover_customer_id TEXT        DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS clover_card_token  TEXT        DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS card_last4         TEXT        DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS card_brand         TEXT        DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS last_billed_at     TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS next_billing_at    TIMESTAMPTZ DEFAULT NULL;

-- Backfill: any company already in 'trial' status without a trial_ends_at
-- gets 14 days from now (graceful migration for existing test companies)
UPDATE companies
SET trial_ends_at = now() + INTERVAL '14 days'
WHERE subscription_status = 'trial'
  AND trial_ends_at IS NULL;

-- Verify
SELECT id, name, slug, subscription_status, trial_ends_at, clover_customer_id
FROM companies
ORDER BY created_at DESC
LIMIT 20;
