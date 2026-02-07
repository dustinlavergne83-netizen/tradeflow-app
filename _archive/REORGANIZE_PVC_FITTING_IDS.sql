-- ================================================================
-- REORGANIZE PVC FITTING IDs FOR BETTER SEARCHABILITY
-- ================================================================
-- Current Pattern: pvc_male_0_5, pvc_female_0_5, pvc_cplg_0_5
-- New Pattern:     pvc12_male, pvc12_female, pvc12_cpl
-- ================================================================
-- Benefits of new pattern:
--   - Search "pvc12_" to find ALL 1/2" PVC materials
--   - Search "pvc12_male" to find ALL 1/2" male adapters
--   - Search "_cpl" to find ALL couplings across all sizes
--   - Size comes first for better organization
-- ================================================================

-- ================================================================
-- STEP 1: CHECK what will be migrated
-- ================================================================

-- All Fittings Combined
SELECT 
  CASE
    WHEN id LIKE 'pvc_male_%' THEN 'PVC Male Adapters'
    WHEN id LIKE 'pvc_female_%' THEN 'PVC Female Adapters'  
    WHEN id LIKE 'pvc_cplg_%' THEN 'PVC Couplings'
  END as fitting_type,
  id as current_id,
  name,
  CASE
    -- Male adapters
    WHEN id = 'pvc_male_0_5' THEN 'pvc12_male'
    WHEN id = 'pvc_male_0_75' THEN 'pvc34_male'
    WHEN id = 'pvc_male_1' THEN 'pvc1_male'
    WHEN id = 'pvc_male_1_25' THEN 'pvc114_male'
    WHEN id = 'pvc_male_1_5' THEN 'pvc112_male'
    WHEN id = 'pvc_male_2' THEN 'pvc2_male'
    WHEN id = 'pvc_male_2_5' THEN 'pvc212_male'
    WHEN id = 'pvc_male_3' THEN 'pvc3_male'
    WHEN id = 'pvc_male_3_5' THEN 'pvc312_male'
    WHEN id = 'pvc_male_4' THEN 'pvc4_male'
    WHEN id = 'pvc_male_5' THEN 'pvc5_male'
    WHEN id = 'pvc_male_6' THEN 'pvc6_male'
    -- Female adapters
    WHEN id = 'pvc_female_0_5' THEN 'pvc12_female'
    WHEN id = 'pvc_female_0_75' THEN 'pvc34_female'
    WHEN id = 'pvc_female_1' THEN 'pvc1_female'
    WHEN id = 'pvc_female_1_25' THEN 'pvc114_female'
    WHEN id = 'pvc_female_1_5' THEN 'pvc112_female'
    WHEN id = 'pvc_female_2' THEN 'pvc2_female'
    WHEN id = 'pvc_female_2_5' THEN 'pvc212_female'
    WHEN id = 'pvc_female_3' THEN 'pvc3_female'
    WHEN id = 'pvc_female_3_5' THEN 'pvc312_female'
    WHEN id = 'pvc_female_4' THEN 'pvc4_female'
    WHEN id = 'pvc_female_5' THEN 'pvc5_female'
    WHEN id = 'pvc_female_6' THEN 'pvc6_female'
    -- Couplings
    WHEN id = 'pvc_cplg_0_5' THEN 'pvc12_cpl'
    WHEN id = 'pvc_cplg_0_75' THEN 'pvc34_cpl'
    WHEN id = 'pvc_cplg_1' THEN 'pvc1_cpl'
    WHEN id = 'pvc_cplg_1_25' THEN 'pvc114_cpl'
    WHEN id = 'pvc_cplg_1_5' THEN 'pvc112_cpl'
    WHEN id = 'pvc_cplg_2' THEN 'pvc2_cpl'
    WHEN id = 'pvc_cplg_2_5' THEN 'pvc212_cpl'
    WHEN id = 'pvc_cplg_3' THEN 'pvc3_cpl'
    WHEN id = 'pvc_cplg_3_5' THEN 'pvc312_cpl'
    WHEN id = 'pvc_cplg_4' THEN 'pvc4_cpl'
    WHEN id = 'pvc_cplg_5' THEN 'pvc5_cpl'
    WHEN id = 'pvc_cplg_6' THEN 'pvc6_cpl'
    ELSE 'ERROR: ' || id
  END as new_id
FROM base_materials
WHERE id LIKE 'pvc_male_%' OR id LIKE 'pvc_female_%' OR id LIKE 'pvc_cplg_%'
ORDER BY id;

-- ================================================================
-- STEP 2: MIGRATION - Reorganize all PVC fitting IDs
-- ================================================================

BEGIN;

-- Male Adapters
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

-- Female Adapters
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

-- Couplings
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
-- STEP 3: VERIFY the migration
-- ================================================================

-- Show all Male Adapters after migration
SELECT 
  'PVC Male Adapters (After Migration)' as category,
  id,
  name,
  basecost,
  laborhours
FROM base_materials
WHERE id LIKE 'pvc%_male'
ORDER BY id;

-- Show all Female Adapters after migration
SELECT 
  'PVC Female Adapters (After Migration)' as category,
  id,
  name,
  basecost,
  laborhours
FROM base_materials
WHERE id LIKE 'pvc%_female'
ORDER BY id;

-- Show all Couplings after migration
SELECT 
  'PVC Couplings (After Migration)' as category,
  id,
  name,
  basecost,
  laborhours
FROM base_materials
WHERE id LIKE 'pvc%_cpl'
ORDER BY id;

-- Count by type
SELECT 
  'Summary' as info,
  COUNT(*) FILTER (WHERE id LIKE 'pvc%_male') as male_adapters,
  COUNT(*) FILTER (WHERE id LIKE 'pvc%_female') as female_adapters,
  COUNT(*) FILTER (WHERE id LIKE 'pvc%_cpl') as couplings,
  COUNT(*) FILTER (WHERE id LIKE 'pvc12_%') as half_inch_fittings
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
WHERE id LIKE 'pvc_male_%' OR id LIKE 'pvc_female_%' OR id LIKE 'pvc_cplg_%'
ORDER BY id;

-- ================================================================
-- MIGRATION COMPLETE
-- ================================================================
SELECT '✅ PVC Fitting ID Reorganization Complete!' as status;
