-- ============================================================
-- FIX: Quick Estimate not saving markup or description
-- Run this in your Supabase SQL Editor
-- ============================================================

-- 1. Add markup columns to estimates table
ALTER TABLE estimates
  ADD COLUMN IF NOT EXISTS material_markup NUMERIC(5,2) DEFAULT 0;

ALTER TABLE estimates
  ADD COLUMN IF NOT EXISTS labor_markup NUMERIC(5,2) DEFAULT 0;

-- 2. Add markup columns to change_orders table
ALTER TABLE change_orders
  ADD COLUMN IF NOT EXISTS material_markup NUMERIC(5,2) DEFAULT 0;

ALTER TABLE change_orders
  ADD COLUMN IF NOT EXISTS labor_markup NUMERIC(5,2) DEFAULT 0;

-- 3. Make sure the notes column exists on estimates (used for estimate description)
ALTER TABLE estimates
  ADD COLUMN IF NOT EXISTS notes TEXT;

-- 4. Make sure description exists on change_orders (used for CO description)
ALTER TABLE change_orders
  ADD COLUMN IF NOT EXISTS description TEXT;

-- 5. Make sure project_id is on estimates so new quick estimates link to their project
ALTER TABLE estimates
  ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE SET NULL;

-- Verify columns were added
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name IN ('estimates', 'change_orders')
  AND column_name IN ('material_markup', 'labor_markup', 'notes', 'description', 'project_id')
ORDER BY table_name, column_name;
