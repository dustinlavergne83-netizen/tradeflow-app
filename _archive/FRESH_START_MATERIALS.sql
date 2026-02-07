-- FRESH START: Drop everything and recreate correctly
-- Run this in Supabase SQL Editor

-- Drop the view first (depends on table)
DROP VIEW IF EXISTS all_materials;

-- Drop the table (this removes everything)
DROP TABLE IF EXISTS base_materials CASCADE;

-- Now run the full migration:
-- Copy and paste the ENTIRE contents of:
-- supabase/migrations/059_create_base_materials_table.sql

-- After running the migration above, verify the columns exist:
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'base_materials' 
ORDER BY ordinal_position;

-- You should see: id, name, description, category, subcategory, unit, baseCost, laborHours, price, labor_hours, etc.
