-- ================================================================
-- REORGANIZE ALL THHN WIRE MATERIAL IDs
-- ================================================================
-- Pattern: thhn12, thhn10, thhn1_0 (for 1/0), thhn250 (for MCM)
-- Remove first underscore after "thhn_"
-- ================================================================

-- ================================================================
-- STEP 1: PREVIEW - Show what will be migrated
-- ================================================================

SELECT 
  'THHN Wire' as category,
  id as current_id,
  name,
  CASE
    WHEN id = 'thhn_16' THEN 'thhn16'
    WHEN id = 'thhn_14' THEN 'thhn14'
    WHEN id = 'thhn_12' THEN 'thhn12'
    WHEN id = 'thhn_10' THEN 'thhn10'
    WHEN id = 'thhn_8' THEN 'thhn8'
    WHEN id = 'thhn_6' THEN 'thhn6'
    WHEN id = 'thhn_4' THEN 'thhn4'
    WHEN id = 'thhn_3' THEN 'thhn3'
    WHEN id = 'thhn_2' THEN 'thhn2'
    WHEN id = 'thhn_1' THEN 'thhn1'
    WHEN id = 'thhn_1_0' THEN 'thhn1_0'
    WHEN id = 'thhn_2_0' THEN 'thhn2_0'
    WHEN id = 'thhn_3_0' THEN 'thhn3_0'
    WHEN id = 'thhn_4_0' THEN 'thhn4_0'
    WHEN id = 'thhn_250' THEN 'thhn250'
    WHEN id = 'thhn_300' THEN 'thhn300'
    WHEN id = 'thhn_350' THEN 'thhn350'
    WHEN id = 'thhn_400' THEN 'thhn400'
    WHEN id = 'thhn_500' THEN 'thhn500'
    WHEN id = 'thhn_600' THEN 'thhn600'
    WHEN id = 'thhn_750' THEN 'thhn750'
    ELSE 'ERROR: ' || id
  END as new_id
FROM base_materials
WHERE id LIKE 'thhn_%' AND name NOT LIKE '%Green%'
ORDER BY id;

-- ================================================================
-- EXECUTE MIGRATION
-- ================================================================

BEGIN;

-- Regular AWG sizes
UPDATE base_materials SET id = 'thhn16' WHERE id = 'thhn_16';
UPDATE base_materials SET id = 'thhn14' WHERE id = 'thhn_14';
UPDATE base_materials SET id = 'thhn12' WHERE id = 'thhn_12';
UPDATE base_materials SET id = 'thhn10' WHERE id = 'thhn_10';
UPDATE base_materials SET id = 'thhn8' WHERE id = 'thhn_8';
UPDATE base_materials SET id = 'thhn6' WHERE id = 'thhn_6';
UPDATE base_materials SET id = 'thhn4' WHERE id = 'thhn_4';
UPDATE base_materials SET id = 'thhn3' WHERE id = 'thhn_3';
UPDATE base_materials SET id = 'thhn2' WHERE id = 'thhn_2';
UPDATE base_materials SET id = 'thhn1' WHERE id = 'thhn_1';

-- Aught sizes (keep underscore between number and 0)
UPDATE base_materials SET id = 'thhn1_0' WHERE id = 'thhn_1_0';
UPDATE base_materials SET id = 'thhn2_0' WHERE id = 'thhn_2_0';
UPDATE base_materials SET id = 'thhn3_0' WHERE id = 'thhn_3_0';
UPDATE base_materials SET id = 'thhn4_0' WHERE id = 'thhn_4_0';

-- MCM sizes
UPDATE base_materials SET id = 'thhn250' WHERE id = 'thhn_250';
UPDATE base_materials SET id = 'thhn300' WHERE id = 'thhn_300';
UPDATE base_materials SET id = 'thhn350' WHERE id = 'thhn_350';
UPDATE base_materials SET id = 'thhn400' WHERE id = 'thhn_400';
UPDATE base_materials SET id = 'thhn500' WHERE id = 'thhn_500';
UPDATE base_materials SET id = 'thhn600' WHERE id = 'thhn_600';
UPDATE base_materials SET id = 'thhn750' WHERE id = 'thhn_750';

COMMIT;

-- ================================================================
-- VERIFICATION
-- ================================================================

SELECT 
  'THHN Wire Migration Summary' as report,
  COUNT(*) FILTER (WHERE id LIKE 'thhn%' AND id NOT LIKE 'thhn%_green') as total_thhn,
  COUNT(*) FILTER (WHERE id LIKE 'thhn%_%' AND id NOT LIKE 'thhn%_green') as aught_sizes
FROM base_materials
WHERE id LIKE 'thhn%';

-- Sample of migrated materials
SELECT 
  'Sample Migrated THHN' as info,
  id,
  name,
  basecost
FROM base_materials
WHERE id LIKE 'thhn%' AND id NOT LIKE 'thhn%_green'
ORDER BY id
LIMIT 20;

-- Check for old patterns
SELECT 
  'OLD PATTERNS (Should be empty)' as warning,
  COUNT(*) as count
FROM base_materials
WHERE id LIKE 'thhn_%' AND id NOT LIKE 'thhn%_0' AND id NOT LIKE 'thhn%_green';

-- ================================================================
-- MIGRATION COMPLETE!
-- ================================================================
SELECT '✅ THHN Wire Material ID Reorganization Complete!' as status,
       'Search "thhn12" to find 12 AWG THHN' as tip1,
       'Search "thhn1_0" for 1/0 AWG THHN' as tip2,
       'Search "thhn250" for 250 MCM THHN' as tip3,
       'Search "thhn%_green" for green THHN ground wire' as tip4;
