-- ================================================================
-- REORGANIZE LIQUIDTIGHT FLEX MATERIAL IDs
-- ================================================================
-- Pattern: lt12_met (metallic), lt12_nm (non-metallic)
--          lt12_90, lt12_met_90, lt12_met_45, lt12_str
-- Following same format as other conduit types
-- ================================================================

-- ================================================================
-- STEP 1: PREVIEW - Show what will be migrated
-- ================================================================

SELECT 
  'Liquidtight Metallic Conduit (LFMC)' as category,
  id as current_id,
  name,
  CASE
    WHEN id = 'lt_metal_0_375' THEN 'lt38_met'
    WHEN id = 'lt_metal_0_5' THEN 'lt12_met'
    WHEN id = 'lt_metal_0_75' THEN 'lt34_met'
    WHEN id = 'lt_metal_1' THEN 'lt1_met'
    WHEN id = 'lt_metal_1_25' THEN 'lt114_met'
    WHEN id = 'lt_metal_1_5' THEN 'lt112_met'
    WHEN id = 'lt_metal_2' THEN 'lt2_met'
    WHEN id = 'lt_metal_2_5' THEN 'lt212_met'
    WHEN id = 'lt_metal_3' THEN 'lt3_met'
    WHEN id = 'lt_metal_4' THEN 'lt4_met'
    ELSE 'ERROR: ' || id
  END as new_id
FROM base_materials
WHERE id LIKE 'lt_metal_%' AND id NOT LIKE 'lt_metal_%_%'
ORDER BY id;

SELECT 
  'Liquidtight Non-Metallic Conduit (LNFC)' as category,
  id as current_id,
  name,
  CASE
    WHEN id = 'lt_nm_0_375' THEN 'lt38_nm'
    WHEN id = 'lt_nm_0_5' THEN 'lt12_nm'
    WHEN id = 'lt_nm_0_75' THEN 'lt34_nm'
    WHEN id = 'lt_nm_1' THEN 'lt1_nm'
    WHEN id = 'lt_nm_1_25' THEN 'lt114_nm'
    WHEN id = 'lt_nm_1_5' THEN 'lt112_nm'
    WHEN id = 'lt_nm_2' THEN 'lt2_nm'
    WHEN id = 'lt_nm_2_5' THEN 'lt212_nm'
    WHEN id = 'lt_nm_3' THEN 'lt3_nm'
    WHEN id = 'lt_nm_4' THEN 'lt4_nm'
    ELSE 'ERROR: ' || id
  END as new_id
FROM base_materials
WHERE id LIKE 'lt_nm_%'
ORDER BY id;

-- ================================================================
-- EXECUTE ALL MIGRATIONS
-- ================================================================

BEGIN;

-- ==== METALLIC CONDUIT (LFMC) ====
UPDATE base_materials SET id = 'lt38_met' WHERE id = 'lt_metal_0_375';
UPDATE base_materials SET id = 'lt12_met' WHERE id = 'lt_metal_0_5';
UPDATE base_materials SET id = 'lt34_met' WHERE id = 'lt_metal_0_75';
UPDATE base_materials SET id = 'lt1_met' WHERE id = 'lt_metal_1';
UPDATE base_materials SET id = 'lt114_met' WHERE id = 'lt_metal_1_25';
UPDATE base_materials SET id = 'lt112_met' WHERE id = 'lt_metal_1_5';
UPDATE base_materials SET id = 'lt2_met' WHERE id = 'lt_metal_2';
UPDATE base_materials SET id = 'lt212_met' WHERE id = 'lt_metal_2_5';
UPDATE base_materials SET id = 'lt3_met' WHERE id = 'lt_metal_3';
UPDATE base_materials SET id = 'lt4_met' WHERE id = 'lt_metal_4';

-- ==== NON-METALLIC CONDUIT (LNFC) ====
UPDATE base_materials SET id = 'lt38_nm' WHERE id = 'lt_nm_0_375';
UPDATE base_materials SET id = 'lt12_nm' WHERE id = 'lt_nm_0_5';
UPDATE base_materials SET id = 'lt34_nm' WHERE id = 'lt_nm_0_75';
UPDATE base_materials SET id = 'lt1_nm' WHERE id = 'lt_nm_1';
UPDATE base_materials SET id = 'lt114_nm' WHERE id = 'lt_nm_1_25';
UPDATE base_materials SET id = 'lt112_nm' WHERE id = 'lt_nm_1_5';
UPDATE base_materials SET id = 'lt2_nm' WHERE id = 'lt_nm_2';
UPDATE base_materials SET id = 'lt212_nm' WHERE id = 'lt_nm_2_5';
UPDATE base_materials SET id = 'lt3_nm' WHERE id = 'lt_nm_3';
UPDATE base_materials SET id = 'lt4_nm' WHERE id = 'lt_nm_4';

-- ==== 90° CONNECTORS (Standard) ====
UPDATE base_materials SET id = 'lt38_90' WHERE id = 'lt_90_0_375';
UPDATE base_materials SET id = 'lt12_90' WHERE id = 'lt_90_0_5';
UPDATE base_materials SET id = 'lt34_90' WHERE id = 'lt_90_0_75';
UPDATE base_materials SET id = 'lt1_90' WHERE id = 'lt_90_1';
UPDATE base_materials SET id = 'lt114_90' WHERE id = 'lt_90_1_25';
UPDATE base_materials SET id = 'lt112_90' WHERE id = 'lt_90_1_5';
UPDATE base_materials SET id = 'lt2_90' WHERE id = 'lt_90_2';
UPDATE base_materials SET id = 'lt212_90' WHERE id = 'lt_90_2_5';
UPDATE base_materials SET id = 'lt3_90' WHERE id = 'lt_90_3';
UPDATE base_materials SET id = 'lt4_90' WHERE id = 'lt_90_4';

-- ==== STRAIGHT CONNECTORS (Standard) ====
UPDATE base_materials SET id = 'lt38_str' WHERE id = 'lt_straight_0_375';
UPDATE base_materials SET id = 'lt12_str' WHERE id = 'lt_straight_0_5';
UPDATE base_materials SET id = 'lt34_str' WHERE id = 'lt_straight_0_75';
UPDATE base_materials SET id = 'lt1_str' WHERE id = 'lt_straight_1';
UPDATE base_materials SET id = 'lt114_str' WHERE id = 'lt_straight_1_25';
UPDATE base_materials SET id = 'lt112_str' WHERE id = 'lt_straight_1_5';
UPDATE base_materials SET id = 'lt2_str' WHERE id = 'lt_straight_2';
UPDATE base_materials SET id = 'lt212_str' WHERE id = 'lt_straight_2_5';
UPDATE base_materials SET id = 'lt3_str' WHERE id = 'lt_straight_3';
UPDATE base_materials SET id = 'lt4_str' WHERE id = 'lt_straight_4';

-- ==== 45° CONNECTORS (Metal) ====
UPDATE base_materials SET id = 'lt38_met_45' WHERE id = 'lt_metal_45_0_375';
UPDATE base_materials SET id = 'lt12_met_45' WHERE id = 'lt_metal_45_0_5';
UPDATE base_materials SET id = 'lt34_met_45' WHERE id = 'lt_metal_45_0_75';
UPDATE base_materials SET id = 'lt1_met_45' WHERE id = 'lt_metal_45_1';
UPDATE base_materials SET id = 'lt114_met_45' WHERE id = 'lt_metal_45_1_25';
UPDATE base_materials SET id = 'lt112_met_45' WHERE id = 'lt_metal_45_1_5';
UPDATE base_materials SET id = 'lt2_met_45' WHERE id = 'lt_metal_45_2';
UPDATE base_materials SET id = 'lt212_met_45' WHERE id = 'lt_metal_45_2_5';
UPDATE base_materials SET id = 'lt3_met_45' WHERE id = 'lt_metal_45_3';
UPDATE base_materials SET id = 'lt4_met_45' WHERE id = 'lt_metal_45_4';

-- ==== 90° CONNECTORS (Metal) ====
UPDATE base_materials SET id = 'lt38_met_90' WHERE id = 'lt_metal_90_0_375';
UPDATE base_materials SET id = 'lt12_met_90' WHERE id = 'lt_metal_90_0_5';
UPDATE base_materials SET id = 'lt34_met_90' WHERE id = 'lt_metal_90_0_75';
UPDATE base_materials SET id = 'lt1_met_90' WHERE id = 'lt_metal_90_1';
UPDATE base_materials SET id = 'lt114_met_90' WHERE id = 'lt_metal_90_1_25';
UPDATE base_materials SET id = 'lt112_met_90' WHERE id = 'lt_metal_90_1_5';
UPDATE base_materials SET id = 'lt2_met_90' WHERE id = 'lt_metal_90_2';
UPDATE base_materials SET id = 'lt212_met_90' WHERE id = 'lt_metal_90_2_5';
UPDATE base_materials SET id = 'lt3_met_90' WHERE id = 'lt_metal_90_3';
UPDATE base_materials SET id = 'lt4_met_90' WHERE id = 'lt_metal_90_4';

-- ==== STRAIGHT CONNECTORS (Metal) ====
UPDATE base_materials SET id = 'lt38_met_str' WHERE id = 'lt_metal_straight_0_375';
UPDATE base_materials SET id = 'lt12_met_str' WHERE id = 'lt_metal_straight_0_5';
UPDATE base_materials SET id = 'lt34_met_str' WHERE id = 'lt_metal_straight_0_75';
UPDATE base_materials SET id = 'lt1_met_str' WHERE id = 'lt_metal_straight_1';
UPDATE base_materials SET id = 'lt114_met_str' WHERE id = 'lt_metal_straight_1_25';
UPDATE base_materials SET id = 'lt112_met_str' WHERE id = 'lt_metal_straight_1_5';
UPDATE base_materials SET id = 'lt2_met_str' WHERE id = 'lt_metal_straight_2';
UPDATE base_materials SET id = 'lt212_met_str' WHERE id = 'lt_metal_straight_2_5';
UPDATE base_materials SET id = 'lt3_met_str' WHERE id = 'lt_metal_straight_3';
UPDATE base_materials SET id = 'lt4_met_str' WHERE id = 'lt_metal_straight_4';

COMMIT;

-- ================================================================
-- VERIFICATION
-- ================================================================

-- Summary by type
SELECT 
  'Liquidtight Migration Summary' as report,
  COUNT(*) FILTER (WHERE id LIKE 'lt%_met' AND id NOT LIKE 'lt%_met_%') as metallic_conduit,
  COUNT(*) FILTER (WHERE id LIKE 'lt%_nm') as non_metallic_conduit,
  COUNT(*) FILTER (WHERE id LIKE 'lt%_90' AND id NOT LIKE 'lt%_met_90') as connectors_90_standard,
  COUNT(*) FILTER (WHERE id LIKE 'lt%_str' AND id NOT LIKE 'lt%_met_str') as connectors_straight_standard,
  COUNT(*) FILTER (WHERE id LIKE 'lt%_met_45') as connectors_45_metal,
  COUNT(*) FILTER (WHERE id LIKE 'lt%_met_90') as connectors_90_metal,
  COUNT(*) FILTER (WHERE id LIKE 'lt%_met_str') as connectors_straight_metal
FROM base_materials
WHERE id LIKE 'lt%';

-- Sample of migrated materials
SELECT 
  'Sample Migrated Liquidtight Materials' as info,
  id,
  name,
  basecost
FROM base_materials
WHERE id LIKE 'lt%'
ORDER BY id
LIMIT 25;

-- Check for old patterns
SELECT 
  'OLD PATTERNS (Should be empty)' as warning,
  COUNT(*) as count
FROM base_materials
WHERE id LIKE 'lt_metal_%' OR id LIKE 'lt_nm_%' OR id LIKE 'lt_90_%' 
   OR id LIKE 'lt_straight_%';

-- ================================================================
-- MIGRATION COMPLETE!
-- ================================================================
SELECT '✅ Liquidtight Flex Material ID Reorganization Complete!' as status,
       'Search "lt12_" to find ALL 1/2" liquidtight materials' as tip1,
       'Search "lt12_met" for 1/2" metallic conduit' as tip2,
       'Search "lt12_nm" for 1/2" non-metallic conduit' as tip3,
       'Search "lt12_met_90" for 1/2" metal 90° connectors' as tip4;
