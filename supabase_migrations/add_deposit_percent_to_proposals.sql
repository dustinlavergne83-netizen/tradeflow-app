-- Add deposit tracking columns to proposals table
-- deposit_percent:   percentage of total_amount required as deposit (e.g. 50 = 50%)
-- deposit_paid:      true once the deposit has been collected via Clover
-- deposit_paid_at:   timestamp of when the deposit was paid
-- deposit_charge_id: Clover charge ID for the deposit payment
-- deposit_amount is kept from the previous migration (stores the calculated dollar amount)

ALTER TABLE proposals
  ADD COLUMN IF NOT EXISTS deposit_percent NUMERIC;

ALTER TABLE proposals
  ADD COLUMN IF NOT EXISTS deposit_paid BOOLEAN DEFAULT FALSE;

ALTER TABLE proposals
  ADD COLUMN IF NOT EXISTS deposit_paid_at TIMESTAMPTZ;

ALTER TABLE proposals
  ADD COLUMN IF NOT EXISTS deposit_charge_id TEXT;
