-- ================================================================
-- DELETE ALL EMT MATERIALS
-- ================================================================
-- IMPORTANT: Run EXPORT_EMT_MATERIALS_FOR_REIMPORT.sql FIRST!
-- This will DELETE all EMT materials from the database
-- Make sure you have exported the CSV backup before running this!
-- ================================================================

-- Check what will be deleted (run this first!)
SELECT 
  'Materials that will be DELETED' as warning,
  COUNT(*) as total_count
FROM base_materials
WHERE name ILIKE '%EMT%';

-- Show the materials
SELECT 
  'EMT Materials to Delete' as info,
  id,
  name,
  basecost,
  laborhours
FROM base_materials
WHERE name ILIKE '%EMT%'
ORDER BY name;

-- ================================================================
-- ACTUAL DELETE (uncomment when ready)
-- ================================================================
/*
BEGIN;

DELETE FROM base_materials
WHERE name ILIKE '%EMT%';

COMMIT;

-- Verify deletion
SELECT 
  'Remaining EMT Materials (should be 0)' as status,
  COUNT(*) as count
FROM base_materials
WHERE name ILIKE '%EMT%';
*/
