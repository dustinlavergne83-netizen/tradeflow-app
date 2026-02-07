-- ================================================================
-- REORGANIZE BARE COPPER WIRE MATERIAL IDs
-- ================================================================
-- Pattern: bare12, bare10, bare1_0 (for 1/0), bare4_0 (for 4/0)
-- Shortened from barecu_ to bare
-- ================================================================

-- ================================================================
-- STEP 1: PREVIEW - Show what will be migrated
-- ================================================================

SELECT 
  'Bare Copper Wire' as category,
  id as current_id,
  name,
  CASE
    WHEN id = 'barecu_14' THEN 'bare14'
    WHEN id = 'barecu_12' THEN 'bare12'
    WHEN id = 'barecu_10' THEN 'bare10'
    WHEN id = 'barecu_8' THEN 'bare8'
    WHEN id = 'barecu_6' THEN 'bare6'
    WHEN id = 'barecu_4' THEN 'bare4'
    WHEN id = 'barecu_2' THEN 'bare2'
    WHEN id = 'barecu_1_0' THEN 'bare1_0'
    WHEN id = 'barecu_4_0' THEN 'bare4_0'
    ELSE 'ERROR: ' || id
  END as new_id
FROM base_materials
WHERE id LIKE 'barecu_%'
ORDER BY id;

-- ================================================================
-- EXECUTE MIGRATION
-- ================================================================

BEGIN;

UPDATE base_materials SET id = 'bare14' WHERE id = 'barecu_14';
UPDATE base_materials SET id = 'bare12' WHERE id = 'barecu_12';
UPDATE base_materials SET id = 'bare10' WHERE id = 'barecu_10';
UPDATE base_materials SET id = 'bare8' WHERE id = 'barecu_8';
UPDATE base_materials SET id = 'bare6' WHERE id = 'barecu_6';
UPDATE base_materials SET id = 'bare4' WHERE id = 'barecu_4';
UPDATE base_materials SET id = 'bare2' WHERE id = 'barecu_2';
UPDATE base_materials SET id = 'bare1_0' WHERE id = 'barecu_1_0';
UPDATE base_materials SET id = 'bare4_0' WHERE id = 'barecu_4_0';

COMMIT;

-- ================================================================
-- VERIFICATION
-- ================================================================

SELECT 
  'Bare Copper After Migration' as report,
  COUNT(*) as total_bare_copper
FROM base_materials
WHERE id LIKE 'bare%';

-- Sample of migrated materials
SELECT 
  'Sample Migrated Bare Copper' as info,
  id,
  name,
  basecost
FROM base_materials
WHERE id LIKE 'bare%'
ORDER BY id;

-- Check for old patterns
SELECT 
  'OLD PATTERNS (Should be empty)' as warning,
  COUNT(*) as count
FROM base_materials
WHERE id LIKE 'barecu_%';

-- ================================================================
-- MIGRATION COMPLETE!
-- ================================================================
SELECT '✅ Bare Copper Wire Material ID Reorganization Complete!' as status,
       'Search "bare12" to find 12 AWG bare copper' as tip1,
       'Search "bare1_0" for 1/0 AWG bare copper' as tip2,
       'Search "bare" to find ALL bare copper wire' as tip3;
