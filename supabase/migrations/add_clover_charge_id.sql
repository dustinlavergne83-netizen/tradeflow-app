-- Add Clover charge ID column to invoices table
-- Run this in the Supabase SQL editor (Dashboard → SQL Editor → New Query)

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS clover_charge_id TEXT,
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;

-- Optional: index for looking up invoices by Clover charge
CREATE INDEX IF NOT EXISTS idx_invoices_clover_charge_id
  ON invoices (clover_charge_id)
  WHERE clover_charge_id IS NOT NULL;
