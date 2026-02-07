-- ================================================================
-- COMPLETE PVC MATERIAL ID REORGANIZATION
-- ================================================================
-- This script runs both the conduit and fitting reorganizations
-- Run this single script to update all PVC material IDs at once
-- ================================================================

-- ================================================================
-- PART 1: REORGANIZE BASE CONDUIT
-- ================================================================
-- OLD: pvc40_0_5, pvc80_0_5, pvc40_1, pvc80_1
-- NEW: pvc12_, pvc12_80_, pvc1_, pvc1_80_
-- ================================================================

-- Preview conduit changes - Schedule 40
SELECT 
  'PVC Schedule 40 Conduit' as migration_phase,
  id as current_id,
  name,
  CASE
    WHEN id = 'pvc40_0_5' THEN 'pvc12_'
    WHEN id = 'pvc40_0_75' THEN 'pvc34_'
    WHEN id = 'pvc40_1' THEN 'pvc1_'
    WHEN id = 'pvc40_1_25' THEN 'pvc114_'
    WHEN id = 'pvc40_1_5' THEN 'pvc112_'
    WHEN id = 'pvc40_2' THEN 'pvc2_'
    WHEN id = 'pvc40_2_5' THEN 'pvc212_'
    WHEN id = 'pvc40_3' THEN 'pvc3_'
    WHEN id = 'pvc40_4' THEN 'pvc4_'
    ELSE id
  END as new_id
FROM base_materials
WHERE id LIKE 'pvc40_%'
ORDER BY id;

-- Preview conduit changes - Schedule 80
SELECT 
  'PVC Schedule 80 Conduit' as migration_phase,
  id as current_id,
  name,
  CASE
    WHEN id = 'pvc80_0_5' THEN 'pvc12_80_'
    WHEN id = 'pvc80_0_75' THEN 'pvc34_80_'
    WHEN id = 'pvc80_1' THEN 'pvc1_80_'
    WHEN id = 'pvc80_1_25' THEN 'pvc114_80_'
    WHEN id = 'pvc80_1_5' THEN 'pvc112_80_'
    WHEN id = 'pvc80_2' THEN 'pvc2_80_'
    WHEN id = 'pvc80_2_5' THEN 'pvc212_80_'
    WHEN id = 'pvc80_3' THEN 'pvc3_80_'
    WHEN id = 'pvc80_4' THEN 'pvc4_80_'
    ELSE id
  END as new_id
FROM base_materials
WHERE id LIKE 'pvc80_%'
ORDER BY id;

-- ================================================================
-- PART 2: REORGANIZE FITTINGS
-- ================================================================
-- OLD: pvc_male_0_5, pvc_female_0_5, pvc_cplg_0_5
-- NEW: pvc12_male, pvc12_female, pvc12_cpl
-- ================================================================

-- Preview fitting changes
SELECT 
  'PVC Fittings' as migration_phase,
  id as current_id,
  name,
  CASE
    -- Male adapters
    WHEN id = 'pvc_male_0_5' THEN 'pvc12_male'
    WHEN id = 'pvc_male_0_75' THEN 'pvc34_male'
    WHEN id = 'pvc_male_1' THEN 'pvc1_male'
    WHEN id = 'pvc_male_1_5' THEN 'pvc112_male'
    WHEN id = 'pvc_male_2' THEN 'pvc2_male'
    -- Female adapters
    WHEN id = 'pvc_female_0_5' THEN 'pvc12_female'
    WHEN id = 'pvc_female_0_75' THEN 'pvc34_female'
    WHEN id = 'pvc_female_1' THEN 'pvc1_female'
    WHEN id = 'pvc_female_1_5' THEN 'pvc112_female'
    WHEN id = 'pvc_female_2' THEN 'pvc2_female'
    -- Couplings
    WHEN id = 'pvc_cplg_0_5' THEN 'pvc12_cpl'
    WHEN id = 'pvc_cplg_0_75' THEN 'pvc34_cpl'
    WHEN id = 'pvc_cplg_1' THEN 'pvc1_cpl'
    WHEN id = 'pvc_cplg_1_5' THEN 'pvc112_cpl'
    WHEN id = 'pvc_cplg_2' THEN 'pvc2_cpl'
    ELSE id
  END as new_id
FROM base_materials
WHERE id LIKE 'pvc_male_%' OR id LIKE 'pvc_female_%' OR id LIKE 'pvc_cplg_%'
ORDER BY id;

-- ================================================================
-- EXECUTE ALL MIGRATIONS
-- ================================================================

BEGIN;

-- CONDUIT: Schedule 40
UPDATE base_materials SET id = 'pvc12_' WHERE id = 'pvc40_0_5';
UPDATE base_materials SET id = 'pvc34_' WHERE id = 'pvc40_0_75';
UPDATE base_materials SET id = 'pvc1_' WHERE id = 'pvc40_1';
UPDATE base_materials SET id = 'pvc114_' WHERE id = 'pvc40_1_25';
UPDATE base_materials SET id = 'pvc112_' WHERE id = 'pvc40_1_5';
UPDATE base_materials SET id = 'pvc2_' WHERE id = 'pvc40_2';
UPDATE base_materials SET id = 'pvc212_' WHERE id = 'pvc40_2_5';
UPDATE base_materials SET id = 'pvc3_' WHERE id = 'pvc40_3';
UPDATE base_materials SET id = 'pvc4_' WHERE id = 'pvc40_4';

-- CONDUIT: Schedule 80
UPDATE base_materials SET id = 'pvc12_80_' WHERE id = 'pvc80_0_5';
UPDATE base_materials SET id = 'pvc34_80_' WHERE id = 'pvc80_0_75';
UPDATE base_materials SET id = 'pvc1_80_' WHERE id = 'pvc80_1';
UPDATE base_materials SET id = 'pvc114_80_' WHERE id = 'pvc80_1_25';
UPDATE base_materials SET id = 'pvc112_80_' WHERE id = 'pvc80_1_5';
UPDATE base_materials SET id = 'pvc2_80_' WHERE id = 'pvc80_2';
UPDATE base_materials SET id = 'pvc212_80_' WHERE id = 'pvc80_2_5';
UPDATE base_materials SET id = 'pvc3_80_' WHERE id = 'pvc80_3';
UPDATE base_materials SET id = 'pvc4_80_' WHERE id = 'pvc80_4';

-- FITTINGS: Male Adapters
UPDATE base_materials SET id = 'pvc12_male' WHERE id = 'pvc_male_0_5';
UPDATE base_materials SET id = 'pvc34_male' WHERE id = 'pvc_male_0_75';
UPDATE base_materials SET id = 'pvc1_male' WHERE id = 'pvc_male_1';
UPDATE base_materials SET id = 'pvc114_male' WHERE id = 'pvc_male_1_25';
UPDATE base_materials SET id = 'pvc112_male' WHERE id = 'pvc_male_1_5';
UPDATE base_materials SET id = 'pvc2_male' WHERE id = 'pvc_male_2';
UPDATE base_materials SET id = 'pvc212_male' WHERE id = 'pvc_male_2_5';
UPDATE base_materials SET id = 'pvc3_male' WHERE id = 'pvc_male_3';
UPDATE base_materials SET id = 'pvc312_male' WHERE id = 'pvc_male_3_5';
UPDATE base_materials SET id = 'pvc4_male' WHERE id = 'pvc_male_4';
UPDATE base_materials SET id = 'pvc5_male' WHERE id = 'pvc_male_5';
UPDATE base_materials SET id = 'pvc6_male' WHERE id = 'pvc_male_6';

-- FITTINGS: Female Adapters
UPDATE base_materials SET id = 'pvc12_female' WHERE id = 'pvc_female_0_5';
UPDATE base_materials SET id = 'pvc34_female' WHERE id = 'pvc_female_0_75';
UPDATE base_materials SET id = 'pvc1_female' WHERE id = 'pvc_female_1';
UPDATE base_materials SET id = 'pvc114_female' WHERE id = 'pvc_female_1_25';
UPDATE base_materials SET id = 'pvc112_female' WHERE id = 'pvc_female_1_5';
UPDATE base_materials SET id = 'pvc2_female' WHERE id = 'pvc_female_2';
UPDATE base_materials SET id = 'pvc212_female' WHERE id = 'pvc_female_2_5';
UPDATE base_materials SET id = 'pvc3_female' WHERE id = 'pvc_female_3';
UPDATE base_materials SET id = 'pvc312_female' WHERE id = 'pvc_female_3_5';
UPDATE base_materials SET id = 'pvc4_female' WHERE id = 'pvc_female_4';
UPDATE base_materials SET id = 'pvc5_female' WHERE id = 'pvc_female_5';
UPDATE base_materials SET id = 'pvc6_female' WHERE id = 'pvc_female_6';

-- FITTINGS: Couplings
UPDATE base_materials SET id = 'pvc12_cpl' WHERE id = 'pvc_cplg_0_5';
UPDATE base_materials SET id = 'pvc34_cpl' WHERE id = 'pvc_cplg_0_75';
UPDATE base_materials SET id = 'pvc1_cpl' WHERE id = 'pvc_cplg_1';
UPDATE base_materials SET id = 'pvc114_cpl' WHERE id = 'pvc_cplg_1_25';
UPDATE base_materials SET id = 'pvc112_cpl' WHERE id = 'pvc_cplg_1_5';
UPDATE base_materials SET id = 'pvc2_cpl' WHERE id = 'pvc_cplg_2';
UPDATE base_materials SET id = 'pvc212_cpl' WHERE id = 'pvc_cplg_2_5';
UPDATE base_materials SET id = 'pvc3_cpl' WHERE id = 'pvc_cplg_3';
UPDATE base_materials SET id = 'pvc312_cpl' WHERE id = 'pvc_cplg_3_5';
UPDATE base_materials SET id = 'pvc4_cpl' WHERE id = 'pvc_cplg_4';
UPDATE base_materials SET id = 'pvc5_cpl' WHERE id = 'pvc_cplg_5';
UPDATE base_materials SET id = 'pvc6_cpl' WHERE id = 'pvc_cplg_6';

COMMIT;

-- ================================================================
-- VERIFICATION - Show all reorganized materials
-- ================================================================

-- Base Conduit Schedule 40
SELECT 
  'PVC SCHEDULE 40 CONDUIT (After Migration)' as category,
  id,
  name,
  basecost,
  laborhours
FROM base_materials
WHERE id IN ('pvc12_', 'pvc34_', 'pvc1_', 'pvc114_', 'pvc112_', 'pvc2_', 'pvc212_', 'pvc3_', 'pvc4_')
ORDER BY id;

-- Base Conduit Schedule 80
SELECT 
  'PVC SCHEDULE 80 CONDUIT (After Migration)' as category,
  id,
  name,
  basecost,
  laborhours
FROM base_materials
WHERE id IN ('pvc12_80_', 'pvc34_80_', 'pvc1_80_', 'pvc114_80_', 'pvc112_80_', 'pvc2_80_', 'pvc212_80_', 'pvc3_80_', 'pvc4_80_')
ORDER BY id;

-- Male/Female Adapters
SELECT 
  'PVC ADAPTERS (After Migration)' as category,
  id,
  name,
  basecost,
  laborhours
FROM base_materials
WHERE id LIKE 'pvc%_male' OR id LIKE 'pvc%_female'
ORDER BY id;

-- Couplings
SELECT 
  'PVC COUPLINGS (After Migration)' as category,
  id,
  name,
  basecost,
  laborhours
FROM base_materials
WHERE id LIKE 'pvc%_cpl'
ORDER BY id;

-- ================================================================
-- SUMMARY COUNTS
-- ================================================================
SELECT 
  'MIGRATION SUMMARY' as report,
  COUNT(*) FILTER (WHERE id LIKE 'pvc%_' AND id NOT LIKE '%_80_%') as schedule_40_conduit,
  COUNT(*) FILTER (WHERE id LIKE 'pvc%_80_') as schedule_80_conduit,
  COUNT(*) FILTER (WHERE id LIKE 'pvc%_male') as male_adapters,
  COUNT(*) FILTER (WHERE id LIKE 'pvc%_female') as female_adapters,
  COUNT(*) FILTER (WHERE id LIKE 'pvc%_cpl') as couplings,
  COUNT(*) FILTER (WHERE id LIKE 'pvc12_%') as half_inch_all_materials
FROM base_materials
WHERE id LIKE 'pvc%';

-- ================================================================
-- CHECK FOR STRAGGLERS (Should all be empty)
-- ================================================================
SELECT 
  'OLD CONDUIT PATTERNS REMAINING (Should be empty)' as warning,
  id,
  name
FROM base_materials
WHERE id LIKE 'pvc40_%' OR id LIKE 'pvc80_%'
ORDER BY id;

SELECT 
  'OLD FITTING PATTERNS REMAINING (Should be empty)' as warning,
  id,
  name
FROM base_materials
WHERE id LIKE 'pvc_male_%' OR id LIKE 'pvc_female_%' OR id LIKE 'pvc_cplg_%'
ORDER BY id;

-- ================================================================
-- MIGRATION COMPLETE
-- ================================================================
SELECT '✅ PVC Material ID Reorganization Complete!' as status;
