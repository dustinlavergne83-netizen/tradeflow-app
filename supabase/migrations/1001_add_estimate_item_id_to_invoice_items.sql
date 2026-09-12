-- ====================================
-- ADD estimate_item_id TO invoice_items
-- ====================================
-- Supports per-line-item progress billing: each invoice_items row created
-- from a Progress Invoice can now be tied back to the specific estimate_items
-- row (scope-of-work line) it is billing, instead of one lumped draw amount.
-- Enables accurate "previously billed" and "remaining" calculations per line.

ALTER TABLE invoice_items
  ADD COLUMN IF NOT EXISTS estimate_item_id UUID REFERENCES estimate_items(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_invoice_items_estimate_item_id
  ON invoice_items(estimate_item_id);
