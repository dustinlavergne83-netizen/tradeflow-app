-- Add deposit fields to proposals table
-- deposit_required: whether a deposit is needed upon acceptance
-- deposit_amount:   the dollar amount of the deposit

ALTER TABLE proposals
  ADD COLUMN IF NOT EXISTS deposit_required BOOLEAN DEFAULT FALSE;

ALTER TABLE proposals
  ADD COLUMN IF NOT EXISTS deposit_amount NUMERIC;
