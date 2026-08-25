-- Add show_item_prices column to proposals table
-- Controls whether individual line item prices are shown on the proposal PDF
-- true  = full itemized with prices (default, existing behaviour)
-- false = items listed as scope of work but only the total is shown (itemized-no-price mode)
-- Works in conjunction with the existing show_line_items column:
--   show_line_items=false                        → summary only (no items, total shown)
--   show_line_items=true, show_item_prices=true  → itemized with prices
--   show_line_items=true, show_item_prices=false → itemized without per-item prices

ALTER TABLE proposals
  ADD COLUMN IF NOT EXISTS show_item_prices BOOLEAN DEFAULT TRUE;
