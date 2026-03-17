-- =====================================================
-- STRIPE PAYMENT COLUMNS FOR INVOICES
-- Run this in Supabase SQL Editor
-- =====================================================

-- Add Stripe tracking columns to the invoices table
ALTER TABLE invoices 
  ADD COLUMN IF NOT EXISTS stripe_payment_intent_id TEXT,
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;

-- Allow 'payment_pending' as a valid invoice status (for ACH transfers in transit)
-- If you have a status CHECK constraint, update it:
-- ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_status_check;
-- ALTER TABLE invoices ADD CONSTRAINT invoices_status_check 
--   CHECK (status IN ('draft','sent','viewed','payment_pending','paid','overdue','cancelled'));

-- Index for faster lookups by Stripe payment intent
CREATE INDEX IF NOT EXISTS idx_invoices_stripe_payment_intent 
  ON invoices(stripe_payment_intent_id) 
  WHERE stripe_payment_intent_id IS NOT NULL;

-- Verify
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'invoices' 
  AND column_name IN ('stripe_payment_intent_id', 'paid_at')
ORDER BY column_name;
