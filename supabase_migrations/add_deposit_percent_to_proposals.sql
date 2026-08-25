-- Add deposit_percent and deposit_paid columns to proposals table
-- deposit_percent: the percentage of total_amount required as deposit (e.g. 50 = 50%)
-- deposit_paid:    true once the deposit has been collected via Clover
-- deposit_amount is kept from the previous migration (stores the calculated dollar amount)

ALTER TABLE proposals
  ADD COLUMN IF NOT EXISTS deposit_percent NUMERIC;

ALTER TABLE proposals
  ADD COLUMN IF NOT EXISTS deposit_paid BOOLEAN DEFAULT FALSE;
