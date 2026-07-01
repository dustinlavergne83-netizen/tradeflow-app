-- ============================================================
-- ADD SOURCE ID COLUMNS TO INVOICES TABLE
-- Run this once in your Supabase SQL editor.
-- These columns permanently tie a progress invoice to the
-- proposal / estimate / change order it was billed from,
-- so the "Previously Billed" calculation is bulletproof and
-- never has to parse invoice notes text.
-- ============================================================

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS source_proposal_id      uuid REFERENCES proposals(id)      ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source_estimate_id      uuid REFERENCES estimates(id)      ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source_change_order_id  uuid REFERENCES change_orders(id)  ON DELETE SET NULL;

-- Indexes for fast lookup by source
CREATE INDEX IF NOT EXISTS idx_invoices_source_proposal_id     ON invoices(source_proposal_id);
CREATE INDEX IF NOT EXISTS idx_invoices_source_estimate_id     ON invoices(source_estimate_id);
CREATE INDEX IF NOT EXISTS idx_invoices_source_change_order_id ON invoices(source_change_order_id);

-- ============================================================
-- BACKFILL: parse existing invoices that have [PROPOSAL:xxx]
-- or [CO:xxx] or [ESTIMATE:xxx] tags in their notes.
-- This migrates old data to the new columns automatically.
-- ============================================================

-- Backfill source_proposal_id from notes tag [PROPOSAL:<uuid>]
UPDATE invoices
SET source_proposal_id = (
  regexp_match(notes, '\[PROPOSAL:([0-9a-f\-]+)\]')
)[1]::uuid
WHERE notes LIKE '%[PROPOSAL:%'
  AND source_proposal_id IS NULL;

-- Backfill source_estimate_id from notes tag [ESTIMATE:<uuid>]
UPDATE invoices
SET source_estimate_id = (
  regexp_match(notes, '\[ESTIMATE:([0-9a-f\-]+)\]')
)[1]::uuid
WHERE notes LIKE '%[ESTIMATE:%'
  AND source_estimate_id IS NULL
  AND (regexp_match(notes, '\[ESTIMATE:([0-9a-f\-]+)\]'))[1] IS NOT NULL
  AND (regexp_match(notes, '\[ESTIMATE:([0-9a-f\-]+)\]'))[1] != '';

-- Backfill source_change_order_id from notes tag [CO:<uuid>]
UPDATE invoices
SET source_change_order_id = (
  regexp_match(notes, '\[CO:([0-9a-f\-]+)\]')
)[1]::uuid
WHERE notes LIKE '%[CO:%'
  AND source_change_order_id IS NULL;
