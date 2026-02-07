-- ================================================================
-- DELETE ALL ASSEMBLIES - CLEAN SLATE
-- ================================================================
-- This will delete all assemblies and their components
-- Use this BEFORE reorganizing material IDs so you can rebuild
-- assemblies with the new consistent material ID structure
-- ================================================================

-- ================================================================
-- STEP 1: CHECK what will be deleted
-- ================================================================

-- Count assemblies
SELECT 
  'Total Assemblies to Delete' as info,
  COUNT(*) as assembly_count
FROM assemblies;

-- Count assembly components
SELECT 
  'Total Assembly Components to Delete' as info,
  COUNT(*) as component_count
FROM assembly_components;

-- Show sample of assemblies
SELECT 
  'Sample Assemblies' as info,
  id,
  name,
  category,
  created_at
FROM assemblies
ORDER BY created_at DESC
LIMIT 20;

-- ================================================================
-- STEP 2: BACKUP QUERY (Optional - save to CSV before deleting)
-- ================================================================
/*
-- Export assemblies to CSV (run this first if you want a backup)
SELECT 
  a.id as assembly_id,
  a.name as assembly_name,
  a.category as assembly_category,
  a.description as assembly_description,
  a.unit,
  a.total_material_cost,
  a.total_labor_hours,
  ac.material_id,
  bm.name as material_name,
  ac.component_quantity,
  ac.component_quantity_type,
  ac.material_unit_cost,
  ac.labor_hours
FROM assemblies a
LEFT JOIN assembly_components ac ON a.id = ac.assembly_id
LEFT JOIN base_materials bm ON ac.material_id = bm.id
ORDER BY a.name, ac.sequence;
*/

-- ================================================================
-- STEP 3: DELETE ALL ASSEMBLIES AND COMPONENTS
-- ================================================================
-- IMPORTANT: This is permanent! Make sure you've backed up if needed.
-- Uncomment below when ready to execute.

/*
-- Start transaction for safety
BEGIN;

-- Delete assembly components first (foreign key constraint)
DELETE FROM assembly_components;

-- Delete assemblies
DELETE FROM assemblies;

-- Verify deletion
SELECT 'Assemblies Remaining' as check_type, COUNT(*) as count FROM assemblies;
SELECT 'Components Remaining' as check_type, COUNT(*) as count FROM assembly_components;

-- If everything looks good, commit
COMMIT;

-- If something went wrong, rollback
-- ROLLBACK;
*/

-- ================================================================
-- STEP 4: VERIFY after deletion
-- ================================================================
/*
-- Run after deletion to confirm
SELECT 'Final Assembly Count' as info, COUNT(*) as count FROM assemblies;
SELECT 'Final Component Count' as info, COUNT(*) as count FROM assembly_components;

-- Reset sequences if needed (PostgreSQL)
-- This ensures new assemblies start with clean IDs
-- SELECT setval('assemblies_id_seq', 1, false);
*/

-- ================================================================
-- NOTES:
-- ================================================================
-- After deleting assemblies:
-- 1. Migrate all material IDs to new consistent format
-- 2. Rebuild assemblies using new material IDs
-- 3. Assemblies will be easier to create with consistent IDs
-- 4. No more mixing old/new ID formats
-- ================================================================
