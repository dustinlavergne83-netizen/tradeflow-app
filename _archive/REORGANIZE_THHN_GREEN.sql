-- ================================================================
-- REORGANIZE GREEN THHN WIRE MATERIAL IDs
-- ================================================================
-- Pattern: thhn12_green, thhn10_green, thhn1_0_green (for 1/0)
-- Size first, color second
-- ================================================================

-- ================================================================
-- STEP 1: PREVIEW - Show what will be migrated
-- ================================================================

SELECT 
  'Green THHN Wire' as category,
  id as current_id,
  name,
  CASE
    WHEN id = 'grn_14' THEN 'thhn14_green'
    WHEN id = 'grn_12' THEN 'thhn12_green'
    WHEN id = 'grn_10' THEN 'thhn10_green'
    WHEN id = 'grn_8' THEN 'thhn8_green'
    WHEN id = 'grn_6' THEN 'thhn6_green'
    WHEN id = 'grn_4' THEN 'thhn4_green'
    WHEN id = 'grn_2' THEN 'thhn2_green'
    WHEN id = 'grn_1_0' THEN 'thhn1_0_green'
    WHEN id = 'grn_2_0' THEN 'thhn2_0_green'
    WHEN id = 'grn_4_0' THEN 'thhn4_0_green'
    ELSE 'ERROR: ' || id
  END as new_id
FROM base_materials
WHERE id LIKE 'grn_%'
ORDER BY id;

-- ================================================================
-- EXECUTE MIGRATION
-- ================================================================

BEGIN;

UPDATE base_materials SET id = 'thhn14_green' WHERE id = 'grn_14';
UPDATE base_materials SET id = 'thhn12_green' WHERE id = 'grn_12';
UPDATE base_materials SET id = 'thhn10_green' WHERE id = 'grn_10';
UPDATE base_materials SET id = 'thhn8_green' WHERE id = 'grn_8';
UPDATE base_materials SET id = 'thhn6_green' WHERE id = 'grn_6';
UPDATE base_materials SET id = 'thhn4_green' WHERE id = 'grn_4';
UPDATE base_materials SET id = 'thhn2_green' WHERE id = 'grn_2';
UPDATE base_materials SET id = 'thhn1_0_green' WHERE id = 'grn_1_0';
UPDATE base_materials SET id = 'thhn2_0_green' WHERE id = 'grn_2_0';
UPDATE base_materials SET id = 'thhn4_0_green' WHERE id = 'grn_4_0';

COMMIT;

-- ================================================================
-- VERIFICATION
-- ================================================================

SELECT 
  'Green THHN After Migration' as report,
  COUNT(*) as total_green_thhn,
  COUNT(*) FILTER (WHERE id LIKE 'thhn%_green') as correct_pattern
FROM base_materials
WHERE name LIKE '%Green THHN%' OR id LIKE 'thhn%_green';

-- Sample of migrated materials
SELECT 
  'Sample Migrated THHN Green' as info,
  id,
  name,
  basecost
FROM base_materials
WHERE id LIKE 'thhn%_green'
ORDER BY id;

-- Check for old patterns
SELECT 
  'OLD PATTERNS (Should be empty)' as warning,
  COUNT(*) as count
FROM base_materials
WHERE id LIKE 'grn_%';

-- ================================================================
-- MIGRATION COMPLETE!
-- ================================================================
SELECT '✅ Green THHN Wire Material ID Reorganization Complete!' as status,
       'Search "thhn12_" to find ALL 12 AWG THHN (all colors)' as tip1,
       'Search "_green" to find ALL green wire' as tip2,
       'Search "thhn1_0_" for 1/0 AWG THHN (aught sizes use underscore)' as tip3;
