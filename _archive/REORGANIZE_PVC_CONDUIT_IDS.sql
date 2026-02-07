-- ================================================================
-- REORGANIZE PVC CONDUIT BASE IDs FOR BETTER SEARCHABILITY
-- ================================================================
-- This script reorganizes ONLY the base conduit (not fittings/straps)
-- Current Pattern: pvc40_0_5, pvc80_0_5, pvc40_1, pvc80_1, etc.
-- New Pattern:     pvc12_, pvc12_80_, pvc1_, pvc1_80_, etc.
-- ================================================================
-- Benefits of new pattern:
--   - Search "pvc12_" to find ALL 1/2" PVC (Sch 40 + Sch 80)
--   - Search "pvc12_80" to find ONLY 1/2" Schedule 80
--   - Search "pvc1_" without matching pvc112 or pvc114
--   - Consistent with EMT naming convention
-- ================================================================

-- ================================================================
-- STEP 1: CHECK what will be migrated
-- ================================================================

-- Schedule 40 base conduit
SELECT 
  'PVC Schedule 40 Base Conduit' as status,
  id as current_id,
  name,
  CASE
    WHEN id = 'pvc40_0_5' THEN 'pvc12_'      -- 1/2"
    WHEN id = 'pvc40_0_75' THEN 'pvc34_'     -- 3/4"
    WHEN id = 'pvc40_1' THEN 'pvc1_'         -- 1"
    WHEN id = 'pvc40_1_25' THEN 'pvc114_'    -- 1-1/4"
    WHEN id = 'pvc40_1_5' THEN 'pvc112_'     -- 1-1/2"
    WHEN id = 'pvc40_2' THEN 'pvc2_'         -- 2"
    WHEN id = 'pvc40_2_5' THEN 'pvc212_'     -- 2-1/2"
    WHEN id = 'pvc40_3' THEN 'pvc3_'         -- 3"
    WHEN id = 'pvc40_3_5' THEN 'pvc312_'     -- 3-1/2"
    WHEN id = 'pvc40_4' THEN 'pvc4_'         -- 4"
    WHEN id = 'pvc40_5' THEN 'pvc5_'         -- 5"
    WHEN id = 'pvc40_6' THEN 'pvc6_'         -- 6"
    ELSE id
  END as new_id
FROM base_materials
WHERE id LIKE 'pvc40_%'
ORDER BY id;

-- Schedule 80 base conduit
SELECT 
  'PVC Schedule 80 Base Conduit' as status,
  id as current_id,
  name,
  CASE
    WHEN id = 'pvc80_0_5' THEN 'pvc12_80_'      -- 1/2"
    WHEN id = 'pvc80_0_75' THEN 'pvc34_80_'     -- 3/4"
    WHEN id = 'pvc80_1' THEN 'pvc1_80_'         -- 1"
    WHEN id = 'pvc80_1_25' THEN 'pvc114_80_'    -- 1-1/4"
    WHEN id = 'pvc80_1_5' THEN 'pvc112_80_'     -- 1-1/2"
    WHEN id = 'pvc80_2' THEN 'pvc2_80_'         -- 2"
    WHEN id = 'pvc80_2_5' THEN 'pvc212_80_'     -- 2-1/2"
    WHEN id = 'pvc80_3' THEN 'pvc3_80_'         -- 3"
    WHEN id = 'pvc80_3_5' THEN 'pvc312_80_'     -- 3-1/2"
    WHEN id = 'pvc80_4' THEN 'pvc4_80_'         -- 4"
    WHEN id = 'pvc80_5' THEN 'pvc5_80_'         -- 5"
    WHEN id = 'pvc80_6' THEN 'pvc6_80_'         -- 6"
    ELSE id
  END as new_id
FROM base_materials
WHERE id LIKE 'pvc80_%'
ORDER BY id;

-- ================================================================
-- STEP 2: MIGRATION - Add trailing underscore to base conduit
-- ================================================================

BEGIN;

-- Schedule 40 base conduit
UPDATE base_materials SET id = 'pvc12_' WHERE id = 'pvc40_0_5';      -- 1/2"
UPDATE base_materials SET id = 'pvc34_' WHERE id = 'pvc40_0_75';     -- 3/4"
UPDATE base_materials SET id = 'pvc1_' WHERE id = 'pvc40_1';         -- 1"
UPDATE base_materials SET id = 'pvc114_' WHERE id = 'pvc40_1_25';    -- 1-1/4"
UPDATE base_materials SET id = 'pvc112_' WHERE id = 'pvc40_1_5';     -- 1-1/2"
UPDATE base_materials SET id = 'pvc2_' WHERE id = 'pvc40_2';         -- 2"
UPDATE base_materials SET id = 'pvc212_' WHERE id = 'pvc40_2_5';     -- 2-1/2"
UPDATE base_materials SET id = 'pvc3_' WHERE id = 'pvc40_3';         -- 3"
UPDATE base_materials SET id = 'pvc312_' WHERE id = 'pvc40_3_5';     -- 3-1/2"
UPDATE base_materials SET id = 'pvc4_' WHERE id = 'pvc40_4';         -- 4"
UPDATE base_materials SET id = 'pvc5_' WHERE id = 'pvc40_5';         -- 5"
UPDATE base_materials SET id = 'pvc6_' WHERE id = 'pvc40_6';         -- 6"

-- Schedule 80 base conduit
UPDATE base_materials SET id = 'pvc12_80_' WHERE id = 'pvc80_0_5';      -- 1/2"
UPDATE base_materials SET id = 'pvc34_80_' WHERE id = 'pvc80_0_75';     -- 3/4"
UPDATE base_materials SET id = 'pvc1_80_' WHERE id = 'pvc80_1';         -- 1"
UPDATE base_materials SET id = 'pvc114_80_' WHERE id = 'pvc80_1_25';    -- 1-1/4"
UPDATE base_materials SET id = 'pvc112_80_' WHERE id = 'pvc80_1_5';     -- 1-1/2"
UPDATE base_materials SET id = 'pvc2_80_' WHERE id = 'pvc80_2';         -- 2"
UPDATE base_materials SET id = 'pvc212_80_' WHERE id = 'pvc80_2_5';     -- 2-1/2"
UPDATE base_materials SET id = 'pvc3_80_' WHERE id = 'pvc80_3';         -- 3"
UPDATE base_materials SET id = 'pvc312_80_' WHERE id = 'pvc80_3_5';     -- 3-1/2"
UPDATE base_materials SET id = 'pvc4_80_' WHERE id = 'pvc80_4';         -- 4"
UPDATE base_materials SET id = 'pvc5_80_' WHERE id = 'pvc80_5';         -- 5"
UPDATE base_materials SET id = 'pvc6_80_' WHERE id = 'pvc80_6';         -- 6"

COMMIT;

-- ================================================================
-- STEP 3: VERIFY the migration
-- ================================================================

-- Show all Schedule 40 base conduit after migration
SELECT 
  'PVC Schedule 40 Base Conduit (After Migration)' as category,
  id,
  name,
  basecost,
  laborhours
FROM base_materials
WHERE id IN ('pvc12_', 'pvc34_', 'pvc1_', 'pvc114_', 'pvc112_', 'pvc2_', 'pvc212_', 'pvc3_', 'pvc312_', 'pvc4_', 'pvc5_', 'pvc6_')
ORDER BY id;

-- Show all Schedule 80 base conduit after migration
SELECT 
  'PVC Schedule 80 Base Conduit (After Migration)' as category,
  id,
  name,
  basecost,
  laborhours
FROM base_materials
WHERE id IN ('pvc12_80_', 'pvc34_80_', 'pvc1_80_', 'pvc114_80_', 'pvc112_80_', 'pvc2_80_', 'pvc212_80_', 'pvc3_80_', 'pvc312_80_', 'pvc4_80_', 'pvc5_80_', 'pvc6_80_')
ORDER BY id;

-- Count by schedule
SELECT 
  'Summary' as info,
  COUNT(*) FILTER (WHERE id LIKE 'pvc%_' AND id NOT LIKE '%_80_%') as schedule_40_conduit,
  COUNT(*) FILTER (WHERE id LIKE 'pvc%_80_') as schedule_80_conduit,
  COUNT(*) FILTER (WHERE id LIKE 'pvc12_%') as half_inch_all,
  COUNT(*) FILTER (WHERE id LIKE 'pvc12_80%') as half_inch_sch80_only
FROM base_materials
WHERE id LIKE 'pvc%';

-- ================================================================
-- STEP 4: Check for any old pattern stragglers
-- ================================================================
SELECT 
  'OLD PATTERN STILL EXISTS (Should be empty)' as warning,
  id,
  name
FROM base_materials
WHERE (id LIKE 'pvc40_%' OR id LIKE 'pvc80_%')
ORDER BY id;

-- ================================================================
-- MIGRATION COMPLETE
-- ================================================================
SELECT '✅ PVC Base Conduit ID Reorganization Complete!' as status;
