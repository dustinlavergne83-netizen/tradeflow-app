-- ================================================================
-- REORGANIZE MC AND NM-B CABLE MATERIAL IDs
-- ================================================================
-- Pattern: mc10_2 (remove first underscore), nmb12_3
-- Cable type + size, then underscore + conductors
-- ================================================================

-- ================================================================
-- STEP 1: PREVIEW - Show what will be migrated
-- ================================================================

SELECT 
  'MC Cable' as category,
  id as current_id,
  name,
  CASE
    WHEN id = 'mc_12_2' THEN 'mc12_2'
    WHEN id = 'mc_12_3' THEN 'mc12_3'
    WHEN id = 'mc_10_2' THEN 'mc10_2'
    WHEN id = 'mc_10_3' THEN 'mc10_3'
    WHEN id = 'mc_8_3' THEN 'mc8_3'
    WHEN id = 'mc_6_3' THEN 'mc6_3'
    ELSE 'ERROR: ' || id
  END as new_id
FROM base_materials
WHERE id LIKE 'mc_%'
ORDER BY id;

SELECT 
  'NM-B Cable' as category,
  id as current_id,
  name,
  CASE
    WHEN id = 'nmb_14_2' THEN 'nmb14_2'
    WHEN id = 'nmb_14_3' THEN 'nmb14_3'
    WHEN id = 'nmb_12_2' THEN 'nmb12_2'
    WHEN id = 'nmb_12_3' THEN 'nmb12_3'
    WHEN id = 'nmb_10_2' THEN 'nmb10_2'
    WHEN id = 'nmb_10_3' THEN 'nmb10_3'
    WHEN id = 'nmb_8_2' THEN 'nmb8_2'
    WHEN id = 'nmb_8_3' THEN 'nmb8_3'
    WHEN id = 'nmb_6_2' THEN 'nmb6_2'
    WHEN id = 'nmb_6_3' THEN 'nmb6_3'
    ELSE 'ERROR: ' || id
  END as new_id
FROM base_materials
WHERE id LIKE 'nmb_%'
ORDER BY id;

-- ================================================================
-- EXECUTE MIGRATION
-- ================================================================

BEGIN;

-- MC Cable
UPDATE base_materials SET id = 'mc12_2' WHERE id = 'mc_12_2';
UPDATE base_materials SET id = 'mc12_3' WHERE id = 'mc_12_3';
UPDATE base_materials SET id = 'mc10_2' WHERE id = 'mc_10_2';
UPDATE base_materials SET id = 'mc10_3' WHERE id = 'mc_10_3';
UPDATE base_materials SET id = 'mc8_3' WHERE id = 'mc_8_3';
UPDATE base_materials SET id = 'mc6_3' WHERE id = 'mc_6_3';

-- NM-B Cable
UPDATE base_materials SET id = 'nmb14_2' WHERE id = 'nmb_14_2';
UPDATE base_materials SET id = 'nmb14_3' WHERE id = 'nmb_14_3';
UPDATE base_materials SET id = 'nmb12_2' WHERE id = 'nmb_12_2';
UPDATE base_materials SET id = 'nmb12_3' WHERE id = 'nmb_12_3';
UPDATE base_materials SET id = 'nmb10_2' WHERE id = 'nmb_10_2';
UPDATE base_materials SET id = 'nmb10_3' WHERE id = 'nmb_10_3';
UPDATE base_materials SET id = 'nmb8_2' WHERE id = 'nmb_8_2';
UPDATE base_materials SET id = 'nmb8_3' WHERE id = 'nmb_8_3';
UPDATE base_materials SET id = 'nmb6_2' WHERE id = 'nmb_6_2';
UPDATE base_materials SET id = 'nmb6_3' WHERE id = 'nmb_6_3';

COMMIT;

-- ================================================================
-- VERIFICATION
-- ================================================================

SELECT 
  'Cable Migration Summary' as report,
  COUNT(*) FILTER (WHERE id LIKE 'mc%') as mc_cables,
  COUNT(*) FILTER (WHERE id LIKE 'nmb%') as nmb_cables,
  COUNT(*) as total
FROM base_materials
WHERE id LIKE 'mc%' OR id LIKE 'nmb%';

-- Sample of migrated materials
SELECT 
  'Sample Migrated Cables' as info,
  id,
  name,
  basecost
FROM base_materials
WHERE id LIKE 'mc%' OR id LIKE 'nmb%'
ORDER BY id;

-- Check for old patterns
SELECT 
  'OLD PATTERNS (Should be empty)' as warning,
  COUNT(*) as count
FROM base_materials
WHERE id LIKE 'mc_%' OR id LIKE 'nmb_%';

-- ================================================================
-- MIGRATION COMPLETE!
-- ================================================================
SELECT '✅ MC and NM-B Cable Material ID Reorganization Complete!' as status,
       'Search "mc12_" to find ALL 12 AWG MC cable' as tip1,
       'Search "nmb12_" to find ALL 12 AWG NM-B cable' as tip2,
       'Search "_2" to find ALL 2-conductor cables' as tip3;
