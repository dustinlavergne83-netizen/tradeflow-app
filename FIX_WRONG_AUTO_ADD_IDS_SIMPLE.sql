-- ========================================
-- SIMPLE FIX: Add auto_add fields to base_materials
-- ========================================
-- This adds the auto_add fields directly to base_materials table
-- so fittings can store their default coupling/connector IDs

-- Step 1: Add columns to base_materials
ALTER TABLE base_materials
ADD COLUMN IF NOT EXISTS auto_add_coupling_id TEXT REFERENCES base_materials(id);

ALTER TABLE base_materials
ADD COLUMN IF NOT EXISTS auto_add_connector_id TEXT REFERENCES base_materials(id);

-- Step 2: Find and display all 1/2" EMT materials
-- ========================================

-- Show all 1/2" EMT Couplings
SELECT id, name, category, basecost 
FROM base_materials 
WHERE name ILIKE '%1/2%emt%coupling%'
  AND name NOT ILIKE '%1-1/2%'
ORDER BY name;

-- Show all 1/2" EMT Connectors
SELECT id, name, category, basecost 
FROM base_materials 
WHERE name ILIKE '%1/2%emt%connector%'
  AND name NOT ILIKE '%1-1/2%'
ORDER BY name;

-- Show all 1/2" EMT Fittings (90s, 45s, bodies)
SELECT id, name, category 
FROM base_materials 
WHERE name ILIKE '%1/2%emt%'
  AND name NOT ILIKE '%1-1/2%'
  AND (name ILIKE '%90%' OR name ILIKE '%45%' OR name ILIKE '%lb%' OR name ILIKE '%ll%' OR name ILIKE '%lr%' OR name ILIKE '%body%')
ORDER BY name;

-- ========================================
-- INSTRUCTIONS:
-- ========================================
-- 1. Run this script to add the columns
-- 2. Review the SELECT results to find the material IDs
-- 3. Use those IDs in UPDATE statements to link fittings to their couplings/connectors
-- ========================================
