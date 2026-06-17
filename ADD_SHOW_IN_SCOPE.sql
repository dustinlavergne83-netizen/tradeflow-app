-- Add show_in_scope column to estimate_items
-- Run this in Supabase SQL Editor

ALTER TABLE estimate_items
  ADD COLUMN IF NOT EXISTS show_in_scope BOOLEAN DEFAULT true;

-- Verify
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'estimate_items'
  AND column_name = 'show_in_scope';
