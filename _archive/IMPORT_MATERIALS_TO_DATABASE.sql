-- Import Materials from CSV to Supabase Database
-- This script will help you import your electrical_materials_comprehensive.csv into the base_materials table

-- Step 1: Run the migration first
-- Make sure you've run: supabase/migrations/059_create_base_materials_table.sql

-- Step 2: Go to Supabase Dashboard > Table Editor > base_materials

-- Step 3: Click "Import data via spreadsheet"

-- Step 4: Upload your electrical_materials_comprehensive.csv file

-- Step 5: Map the columns:
-- CSV Column -> Database Column
-- id -> id
-- name -> name
-- description -> description (if exists)
-- category -> category
-- unit -> unit
-- baseCost -> baseCost
-- laborHours -> laborHours
-- 
-- Leave these as defaults:
-- is_active -> true
-- created_at -> NOW()
-- updated_at -> NOW()
--
-- Note: The table automatically creates price and labor_hours aliases from baseCost and laborHours

-- Alternative: Use SQL INSERT (if you export CSV data)
-- Example format:
/*
INSERT INTO base_materials (id, name, description, category, unit, price, labor_hours, is_active)
VALUES 
  ('WIRE-12-2-NM-250', '12/2 NM-B Wire 250ft', 'Romex 12/2 with ground, 250ft roll', 'WIRE', 'ft', 0.45, 0.002, true),
  ('BOX-4SQ-2G-DEEP', '4" Square Box, 2-1/8" Deep', 'Metal 4-inch square box', 'BOXES', 'ea', 1.25, 0.15, true);
  
-- Add all your materials here...
*/

-- Step 6: Verify the import
SELECT COUNT(*) as total_materials FROM base_materials;
SELECT category, COUNT(*) as count FROM base_materials GROUP BY category ORDER BY count DESC;

-- Step 7: Check a few samples
SELECT * FROM base_materials LIMIT 10;
