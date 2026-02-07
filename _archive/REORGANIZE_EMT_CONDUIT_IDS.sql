-- ================================================================
-- REORGANIZE EMT CONDUIT BASE IDs FOR BETTER SEARCHABILITY
-- ================================================================
-- OLD PATTERN: emt12, emt34, emt1, emt2, etc (base conduit only)
-- NEW PATTERN: emt12_, emt34_, emt1_, emt2_, etc (with trailing underscore)
-- ================================================================
-- Benefits of new pattern:
--   - Search "emt12_" to find ALL 1/2" materials without matching emt112 or emt212
--   - Search "emt1_" to find ALL 1" materials without matching emt114 or emt112
--   - Cleaner, more explicit search patterns
-- ================================================================

-- ================================================================
-- STEP 1: CHECK what will be migrated
-- ================================================================
SELECT 
  'EMT Base Conduit to be Reorganized' as status,
  id as current_id,
  name,
  CASE
    -- Be very specific to only match base conduit IDs (no underscores after size code)
    WHEN id = 'emt12' THEN 'emt12_'
    WHEN id = 'emt34' THEN 'emt34_'
    WHEN id = 'emt1' THEN 'emt1_'
    WHEN id = 'emt114' THEN 'emt114_'
    WHEN id = 'emt112' THEN 'emt112_'
    WHEN id = 'emt2' THEN 'emt2_'
    WHEN id = 'emt212' THEN 'emt212_'
    WHEN id = 'emt3' THEN 'emt3_'
    WHEN id = 'emt312' THEN 'emt312_'
    WHEN id = 'emt4' THEN 'emt4_'
    ELSE id
  END as new_id
FROM base_materials
WHERE id IN ('emt12', 'emt34', 'emt1', 'emt114', 'emt112', 'emt2', 'emt212', 'emt3', 'emt312', 'emt4')
ORDER BY id;

-- ================================================================
-- STEP 2: MIGRATION - Add trailing underscore to base conduit
-- ================================================================

BEGIN;

-- Update each size specifically to avoid any matching issues
UPDATE base_materials SET id = 'emt12_' WHERE id = 'emt12';
UPDATE base_materials SET id = 'emt34_' WHERE id = 'emt34';
UPDATE base_materials SET id = 'emt1_' WHERE id = 'emt1';
UPDATE base_materials SET id = 'emt114_' WHERE id = 'emt114';
UPDATE base_materials SET id = 'emt112_' WHERE id = 'emt112';
UPDATE base_materials SET id = 'emt2_' WHERE id = 'emt2';
UPDATE base_materials SET id = 'emt212_' WHERE id = 'emt212';
UPDATE base_materials SET id = 'emt3_' WHERE id = 'emt3';
UPDATE base_materials SET id = 'emt312_' WHERE id = 'emt312';
UPDATE base_materials SET id = 'emt4_' WHERE id = 'emt4';

COMMIT;

-- ================================================================
-- STEP 3: VERIFY the migration
-- ================================================================

-- Show all base conduit after migration
SELECT 
  'EMT Base Conduit (After Migration)' as category,
  id,
  name,
  basecost,
  laborhours
FROM base_materials
WHERE id IN ('emt12_', 'emt34_', 'emt1_', 'emt114_', 'emt112_', 'emt2_', 'emt212_', 'emt3_', 'emt312_', 'emt4_')
ORDER BY id;

-- Count by size
SELECT 
  'Summary' as info,
  COUNT(*) FILTER (WHERE id LIKE 'emt12_%') as half_inch_materials,
  COUNT(*) FILTER (WHERE id LIKE 'emt34_%') as three_quarter_materials,
  COUNT(*) FILTER (WHERE id LIKE 'emt1_%' AND id NOT LIKE 'emt11%') as one_inch_materials,
  COUNT(*) FILTER (WHERE id LIKE 'emt2_%' AND id NOT LIKE 'emt21%') as two_inch_materials
FROM base_materials
WHERE id LIKE 'emt%';

-- ================================================================
-- STEP 4: Check for any old pattern stragglers
-- ================================================================
SELECT 
  'OLD PATTERN STILL EXISTS (Should be empty)' as warning,
  id,
  name
FROM base_materials
WHERE id IN ('emt12', 'emt34', 'emt1', 'emt114', 'emt112', 'emt2', 'emt212', 'emt3', 'emt312', 'emt4')
  AND name ILIKE '%conduit%'
  AND name NOT ILIKE '%fitting%'
  AND name NOT ILIKE '%connector%'
  AND name NOT ILIKE '%coupling%'
ORDER BY id;
