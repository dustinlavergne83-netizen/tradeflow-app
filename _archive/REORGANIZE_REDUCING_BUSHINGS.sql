-- ================================================================
-- REORGANIZE REDUCING BUSHING MATERIAL IDs
-- ================================================================
-- Pattern: rb1_34 (1" to 3/4"), rb212_2 (2-1/2" to 2")
-- Hub size first, reduced size second
-- ================================================================

-- ================================================================
-- STEP 1: PREVIEW - Show what will be migrated
-- ================================================================

SELECT 
  'Reducing Bushings' as category,
  id as current_id,
  name,
  CASE
    -- From 1" hub
    WHEN id = 'rb_1_to_0_5' THEN 'rb1_12'
    WHEN id = 'rb_1_to_0_75' THEN 'rb1_34'
    
    -- From 1-1/4" hub
    WHEN id = 'rb_1_25_to_0_5' THEN 'rb114_12'
    WHEN id = 'rb_1_25_to_0_75' THEN 'rb114_34'
    WHEN id = 'rb_1_25_to_1' THEN 'rb114_1'
    
    -- From 1-1/2" hub
    WHEN id = 'rb_1_5_to_0_5' THEN 'rb112_12'
    WHEN id = 'rb_1_5_to_0_75' THEN 'rb112_34'
    WHEN id = 'rb_1_5_to_1' THEN 'rb112_1'
    WHEN id = 'rb_1_5_to_1_25' THEN 'rb112_114'
    
    -- From 2" hub
    WHEN id = 'rb_2_to_0_5' THEN 'rb2_12'
    WHEN id = 'rb_2_to_0_75' THEN 'rb2_34'
    WHEN id = 'rb_2_to_1' THEN 'rb2_1'
    WHEN id = 'rb_2_to_1_25' THEN 'rb2_114'
    WHEN id = 'rb_2_to_1_5' THEN 'rb2_112'
    
    -- From 2-1/2" hub
    WHEN id = 'rb_2_5_to_0_5' THEN 'rb212_12'
    WHEN id = 'rb_2_5_to_0_75' THEN 'rb212_34'
    WHEN id = 'rb_2_5_to_1' THEN 'rb212_1'
    WHEN id = 'rb_2_5_to_1_25' THEN 'rb212_114'
    WHEN id = 'rb_2_5_to_1_5' THEN 'rb212_112'
    WHEN id = 'rb_2_5_to_2' THEN 'rb212_2'
    
    -- From 3" hub
    WHEN id = 'rb_3_to_0_5' THEN 'rb3_12'
    WHEN id = 'rb_3_to_0_75' THEN 'rb3_34'
    WHEN id = 'rb_3_to_1' THEN 'rb3_1'
    WHEN id = 'rb_3_to_1_25' THEN 'rb3_114'
    WHEN id = 'rb_3_to_1_5' THEN 'rb3_112'
    WHEN id = 'rb_3_to_2' THEN 'rb3_2'
    WHEN id = 'rb_3_to_2_5' THEN 'rb3_212'
    
    -- From 4" hub
    WHEN id = 'rb_4_to_0_5' THEN 'rb4_12'
    WHEN id = 'rb_4_to_0_75' THEN 'rb4_34'
    WHEN id = 'rb_4_to_1' THEN 'rb4_1'
    WHEN id = 'rb_4_to_1_25' THEN 'rb4_114'
    WHEN id = 'rb_4_to_1_5' THEN 'rb4_112'
    WHEN id = 'rb_4_to_2' THEN 'rb4_2'
    WHEN id = 'rb_4_to_2_5' THEN 'rb4_212'
    WHEN id = 'rb_4_to_3' THEN 'rb4_3'
    
    ELSE 'ERROR: ' || id
  END as new_id
FROM base_materials
WHERE id LIKE 'rb_%'
ORDER BY id;

-- ================================================================
-- EXECUTE MIGRATION
-- ================================================================

BEGIN;

-- From 1" hub
UPDATE base_materials SET id = 'rb1_12' WHERE id = 'rb_1_to_0_5';
UPDATE base_materials SET id = 'rb1_34' WHERE id = 'rb_1_to_0_75';

-- From 1-1/4" hub
UPDATE base_materials SET id = 'rb114_12' WHERE id = 'rb_1_25_to_0_5';
UPDATE base_materials SET id = 'rb114_34' WHERE id = 'rb_1_25_to_0_75';
UPDATE base_materials SET id = 'rb114_1' WHERE id = 'rb_1_25_to_1';

-- From 1-1/2" hub
UPDATE base_materials SET id = 'rb112_12' WHERE id = 'rb_1_5_to_0_5';
UPDATE base_materials SET id = 'rb112_34' WHERE id = 'rb_1_5_to_0_75';
UPDATE base_materials SET id = 'rb112_1' WHERE id = 'rb_1_5_to_1';
UPDATE base_materials SET id = 'rb112_114' WHERE id = 'rb_1_5_to_1_25';

-- From 2" hub
UPDATE base_materials SET id = 'rb2_12' WHERE id = 'rb_2_to_0_5';
UPDATE base_materials SET id = 'rb2_34' WHERE id = 'rb_2_to_0_75';
UPDATE base_materials SET id = 'rb2_1' WHERE id = 'rb_2_to_1';
UPDATE base_materials SET id = 'rb2_114' WHERE id = 'rb_2_to_1_25';
UPDATE base_materials SET id = 'rb2_112' WHERE id = 'rb_2_to_1_5';

-- From 2-1/2" hub
UPDATE base_materials SET id = 'rb212_12' WHERE id = 'rb_2_5_to_0_5';
UPDATE base_materials SET id = 'rb212_34' WHERE id = 'rb_2_5_to_0_75';
UPDATE base_materials SET id = 'rb212_1' WHERE id = 'rb_2_5_to_1';
UPDATE base_materials SET id = 'rb212_114' WHERE id = 'rb_2_5_to_1_25';
UPDATE base_materials SET id = 'rb212_112' WHERE id = 'rb_2_5_to_1_5';
UPDATE base_materials SET id = 'rb212_2' WHERE id = 'rb_2_5_to_2';

-- From 3" hub
UPDATE base_materials SET id = 'rb3_12' WHERE id = 'rb_3_to_0_5';
UPDATE base_materials SET id = 'rb3_34' WHERE id = 'rb_3_to_0_75';
UPDATE base_materials SET id = 'rb3_1' WHERE id = 'rb_3_to_1';
UPDATE base_materials SET id = 'rb3_114' WHERE id = 'rb_3_to_1_25';
UPDATE base_materials SET id = 'rb3_112' WHERE id = 'rb_3_to_1_5';
UPDATE base_materials SET id = 'rb3_2' WHERE id = 'rb_3_to_2';
UPDATE base_materials SET id = 'rb3_212' WHERE id = 'rb_3_to_2_5';

-- From 4" hub
UPDATE base_materials SET id = 'rb4_12' WHERE id = 'rb_4_to_0_5';
UPDATE base_materials SET id = 'rb4_34' WHERE id = 'rb_4_to_0_75';
UPDATE base_materials SET id = 'rb4_1' WHERE id = 'rb_4_to_1';
UPDATE base_materials SET id = 'rb4_114' WHERE id = 'rb_4_to_1_25';
UPDATE base_materials SET id = 'rb4_112' WHERE id = 'rb_4_to_1_5';
UPDATE base_materials SET id = 'rb4_2' WHERE id = 'rb_4_to_2';
UPDATE base_materials SET id = 'rb4_212' WHERE id = 'rb_4_to_2_5';
UPDATE base_materials SET id = 'rb4_3' WHERE id = 'rb_4_to_3';

COMMIT;

-- ================================================================
-- VERIFICATION
-- ================================================================

-- Summary by hub size
SELECT 
  'Reducing Bushing Migration Summary' as report,
  COUNT(*) FILTER (WHERE id LIKE 'rb1_%' AND id NOT LIKE 'rb1_%_%') as from_1_inch,
  COUNT(*) FILTER (WHERE id LIKE 'rb114_%') as from_1_25_inch,
  COUNT(*) FILTER (WHERE id LIKE 'rb112_%') as from_1_5_inch,
  COUNT(*) FILTER (WHERE id LIKE 'rb2_%' AND id NOT LIKE 'rb2_%_%') as from_2_inch,
  COUNT(*) FILTER (WHERE id LIKE 'rb212_%') as from_2_5_inch,
  COUNT(*) FILTER (WHERE id LIKE 'rb3_%') as from_3_inch,
  COUNT(*) FILTER (WHERE id LIKE 'rb4_%') as from_4_inch,
  COUNT(*) as total
FROM base_materials
WHERE id LIKE 'rb%';

-- Sample of migrated materials
SELECT 
  'Sample Migrated Reducing Bushings' as info,
  id,
  name,
  basecost
FROM base_materials
WHERE id LIKE 'rb%'
ORDER BY id
LIMIT 20;

-- Check for old patterns
SELECT 
  'OLD PATTERNS (Should be empty)' as warning,
  COUNT(*) as count
FROM base_materials
WHERE id LIKE 'rb_%_to_%';

-- ================================================================
-- MIGRATION COMPLETE!
-- ================================================================
SELECT '✅ Reducing Bushing Material ID Reorganization Complete!' as status,
       'Search "rb1_" to find ALL 1" hub reducing bushings' as tip1,
       'Search "rb212_2" for 2-1/2" to 2" bushing' as tip2,
       'Search "_12" to find ALL bushings reducing TO 1/2"' as tip3;
