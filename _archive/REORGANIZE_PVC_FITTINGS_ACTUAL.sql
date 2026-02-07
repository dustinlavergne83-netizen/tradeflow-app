-- ================================================================
-- REORGANIZE PVC FITTING IDs FOR BETTER SEARCHABILITY
-- ================================================================
-- Based on actual PVC fittings in database
-- Pattern: pvc12_90, pvc12_45, pvc12_bell, pvc12_bush, pvc12_exp, etc.
-- ================================================================

-- ================================================================
-- STEP 1: PREVIEW - Check what will be migrated
-- ================================================================

SELECT 
  'PVC Fittings Migration Preview' as status,
  id as current_id,
  name,
  CASE
    -- 45° Elbows
    WHEN id = 'pvc_45_0_5' THEN 'pvc12_45'
    WHEN id = 'pvc_45_0_75' THEN 'pvc34_45'
    WHEN id = 'pvc_45_1' THEN 'pvc1_45'
    WHEN id = 'pvc_45_1_25' THEN 'pvc114_45'
    WHEN id = 'pvc_45_1_5' THEN 'pvc112_45'
    WHEN id = 'pvc_45_2' THEN 'pvc2_45'
    WHEN id = 'pvc_45_2_5' THEN 'pvc212_45'
    WHEN id = 'pvc_45_3' THEN 'pvc3_45'
    WHEN id = 'pvc_45_4' THEN 'pvc4_45'
    
    -- 90° Elbows
    WHEN id = 'pvc_90_0_5' THEN 'pvc12_90'
    WHEN id = 'pvc_90_0_75' THEN 'pvc34_90'
    WHEN id = 'pvc_90_1' THEN 'pvc1_90'
    WHEN id = 'pvc_90_1_25' THEN 'pvc114_90'
    WHEN id = 'pvc_90_1_5' THEN 'pvc112_90'
    WHEN id = 'pvc_90_2' THEN 'pvc2_90'
    WHEN id = 'pvc_90_2_5' THEN 'pvc212_90'
    WHEN id = 'pvc_90_3' THEN 'pvc3_90'
    WHEN id = 'pvc_90_4' THEN 'pvc4_90'
    
    -- Bell Ends
    WHEN id = 'pvc_bell_0_5' THEN 'pvc12_bell'
    WHEN id = 'pvc_bell_0_75' THEN 'pvc34_bell'
    WHEN id = 'pvc_bell_1' THEN 'pvc1_bell'
    WHEN id = 'pvc_bell_1_25' THEN 'pvc114_bell'
    WHEN id = 'pvc_bell_1_5' THEN 'pvc112_bell'
    WHEN id = 'pvc_bell_2' THEN 'pvc2_bell'
    WHEN id = 'pvc_bell_2_5' THEN 'pvc212_bell'
    WHEN id = 'pvc_bell_3' THEN 'pvc3_bell'
    WHEN id = 'pvc_bell_4' THEN 'pvc4_bell'
    
    -- Bushings
    WHEN id = 'pvc_bushing_0_5' THEN 'pvc12_bush'
    WHEN id = 'pvc_bushing_0_75' THEN 'pvc34_bush'
    WHEN id = 'pvc_bushing_1' THEN 'pvc1_bush'
    WHEN id = 'pvc_bushing_1_25' THEN 'pvc114_bush'
    WHEN id = 'pvc_bushing_1_5' THEN 'pvc112_bush'
    WHEN id = 'pvc_bushing_2' THEN 'pvc2_bush'
    WHEN id = 'pvc_bushing_2_5' THEN 'pvc212_bush'
    WHEN id = 'pvc_bushing_3' THEN 'pvc3_bush'
    WHEN id = 'pvc_bushing_4' THEN 'pvc4_bush'
    
    -- Expansion Fittings
    WHEN id = 'pvc_expansion_0_5' THEN 'pvc12_exp'
    WHEN id = 'pvc_expansion_0_75' THEN 'pvc34_exp'
    WHEN id = 'pvc_expansion_1' THEN 'pvc1_exp'
    WHEN id = 'pvc_expansion_1_25' THEN 'pvc114_exp'
    WHEN id = 'pvc_expansion_1_5' THEN 'pvc112_exp'
    WHEN id = 'pvc_expansion_2' THEN 'pvc2_exp'
    WHEN id = 'pvc_expansion_2_5' THEN 'pvc212_exp'
    WHEN id = 'pvc_expansion_3' THEN 'pvc3_exp'
    WHEN id = 'pvc_expansion_4' THEN 'pvc4_exp'
    
    -- LB Bodies
    WHEN id = 'pvc_lb_0_5' THEN 'pvc12_lb'
    WHEN id = 'pvc_lb_0_75' THEN 'pvc34_lb'
    WHEN id = 'pvc_lb_1' THEN 'pvc1_lb'
    WHEN id = 'pvc_lb_1_25' THEN 'pvc114_lb'
    WHEN id = 'pvc_lb_1_5' THEN 'pvc112_lb'
    WHEN id = 'pvc_lb_2' THEN 'pvc2_lb'
    WHEN id = 'pvc_lb_2_5' THEN 'pvc212_lb'
    WHEN id = 'pvc_lb_3' THEN 'pvc3_lb'
    WHEN id = 'pvc_lb_4' THEN 'pvc4_lb'
    
    -- LL Bodies
    WHEN id = 'pvc_ll_0_5' THEN 'pvc12_ll'
    WHEN id = 'pvc_ll_0_75' THEN 'pvc34_ll'
    WHEN id = 'pvc_ll_1' THEN 'pvc1_ll'
    WHEN id = 'pvc_ll_1_25' THEN 'pvc114_ll'
    WHEN id = 'pvc_ll_1_5' THEN 'pvc112_ll'
    WHEN id = 'pvc_ll_2' THEN 'pvc2_ll'
    WHEN id = 'pvc_ll_2_5' THEN 'pvc212_ll'
    WHEN id = 'pvc_ll_3' THEN 'pvc3_ll'
    WHEN id = 'pvc_ll_4' THEN 'pvc4_ll'
    
    -- LR Bodies
    WHEN id = 'pvc_lr_0_5' THEN 'pvc12_lr'
    WHEN id = 'pvc_lr_0_75' THEN 'pvc34_lr'
    WHEN id = 'pvc_lr_1' THEN 'pvc1_lr'
    WHEN id = 'pvc_lr_1_25' THEN 'pvc114_lr'
    WHEN id = 'pvc_lr_1_5' THEN 'pvc112_lr'
    WHEN id = 'pvc_lr_2' THEN 'pvc2_lr'
    WHEN id = 'pvc_lr_2_5' THEN 'pvc212_lr'
    WHEN id = 'pvc_lr_3' THEN 'pvc3_lr'
    WHEN id = 'pvc_lr_4' THEN 'pvc4_lr'
    
    -- Long-Sweep 90° Elbows
    WHEN id = 'pvc_longsweep_90_2' THEN 'pvc2_ls90'
    WHEN id = 'pvc_longsweep_90_2_5' THEN 'pvc212_ls90'
    WHEN id = 'pvc_longsweep_90_3' THEN 'pvc3_ls90'
    WHEN id = 'pvc_longsweep_90_4' THEN 'pvc4_ls90'
    
    -- Reducers (keep both sizes in ID)
    WHEN id = 'pvc_reducer_0_75_to_0_5' THEN 'pvc34_red_12'
    WHEN id = 'pvc_reducer_1_to_0_75' THEN 'pvc1_red_34'
    WHEN id = 'pvc_reducer_1_25_to_1' THEN 'pvc114_red_1'
    WHEN id = 'pvc_reducer_1_5_to_1_25' THEN 'pvc112_red_114'
    WHEN id = 'pvc_reducer_2_to_1_5' THEN 'pvc2_red_112'
    WHEN id = 'pvc_reducer_2_5_to_2' THEN 'pvc212_red_2'
    WHEN id = 'pvc_reducer_3_to_2_5' THEN 'pvc3_red_212'
    WHEN id = 'pvc_reducer_4_to_3' THEN 'pvc4_red_3'
    
    ELSE 'ERROR: ' || id
  END as new_id
FROM base_materials
WHERE id LIKE 'pvc_%' 
  AND id NOT LIKE 'pvc40_%' 
  AND id NOT LIKE 'pvc80_%'
  AND id NOT LIKE 'pvc_male_%'
  AND id NOT LIKE 'pvc_female_%'
  AND id NOT LIKE 'pvc_cplg_%'
  AND id NOT LIKE 'pvc_1900_%'
  AND id NOT LIKE 'jbox_%'
ORDER BY id;

-- ================================================================
-- STEP 2: EXECUTE MIGRATION
-- ================================================================

BEGIN;

-- 45° Elbows
UPDATE base_materials SET id = 'pvc12_45' WHERE id = 'pvc_45_0_5';
UPDATE base_materials SET id = 'pvc34_45' WHERE id = 'pvc_45_0_75';
UPDATE base_materials SET id = 'pvc1_45' WHERE id = 'pvc_45_1';
UPDATE base_materials SET id = 'pvc114_45' WHERE id = 'pvc_45_1_25';
UPDATE base_materials SET id = 'pvc112_45' WHERE id = 'pvc_45_1_5';
UPDATE base_materials SET id = 'pvc2_45' WHERE id = 'pvc_45_2';
UPDATE base_materials SET id = 'pvc212_45' WHERE id = 'pvc_45_2_5';
UPDATE base_materials SET id = 'pvc3_45' WHERE id = 'pvc_45_3';
UPDATE base_materials SET id = 'pvc4_45' WHERE id = 'pvc_45_4';

-- 90° Elbows
UPDATE base_materials SET id = 'pvc12_90' WHERE id = 'pvc_90_0_5';
UPDATE base_materials SET id = 'pvc34_90' WHERE id = 'pvc_90_0_75';
UPDATE base_materials SET id = 'pvc1_90' WHERE id = 'pvc_90_1';
UPDATE base_materials SET id = 'pvc114_90' WHERE id = 'pvc_90_1_25';
UPDATE base_materials SET id = 'pvc112_90' WHERE id = 'pvc_90_1_5';
UPDATE base_materials SET id = 'pvc2_90' WHERE id = 'pvc_90_2';
UPDATE base_materials SET id = 'pvc212_90' WHERE id = 'pvc_90_2_5';
UPDATE base_materials SET id = 'pvc3_90' WHERE id = 'pvc_90_3';
UPDATE base_materials SET id = 'pvc4_90' WHERE id = 'pvc_90_4';

-- Bell Ends
UPDATE base_materials SET id = 'pvc12_bell' WHERE id = 'pvc_bell_0_5';
UPDATE base_materials SET id = 'pvc34_bell' WHERE id = 'pvc_bell_0_75';
UPDATE base_materials SET id = 'pvc1_bell' WHERE id = 'pvc_bell_1';
UPDATE base_materials SET id = 'pvc114_bell' WHERE id = 'pvc_bell_1_25';
UPDATE base_materials SET id = 'pvc112_bell' WHERE id = 'pvc_bell_1_5';
UPDATE base_materials SET id = 'pvc2_bell' WHERE id = 'pvc_bell_2';
UPDATE base_materials SET id = 'pvc212_bell' WHERE id = 'pvc_bell_2_5';
UPDATE base_materials SET id = 'pvc3_bell' WHERE id = 'pvc_bell_3';
UPDATE base_materials SET id = 'pvc4_bell' WHERE id = 'pvc_bell_4';

-- Bushings
UPDATE base_materials SET id = 'pvc12_bush' WHERE id = 'pvc_bushing_0_5';
UPDATE base_materials SET id = 'pvc34_bush' WHERE id = 'pvc_bushing_0_75';
UPDATE base_materials SET id = 'pvc1_bush' WHERE id = 'pvc_bushing_1';
UPDATE base_materials SET id = 'pvc114_bush' WHERE id = 'pvc_bushing_1_25';
UPDATE base_materials SET id = 'pvc112_bush' WHERE id = 'pvc_bushing_1_5';
UPDATE base_materials SET id = 'pvc2_bush' WHERE id = 'pvc_bushing_2';
UPDATE base_materials SET id = 'pvc212_bush' WHERE id = 'pvc_bushing_2_5';
UPDATE base_materials SET id = 'pvc3_bush' WHERE id = 'pvc_bushing_3';
UPDATE base_materials SET id = 'pvc4_bush' WHERE id = 'pvc_bushing_4';

-- Expansion Fittings
UPDATE base_materials SET id = 'pvc12_exp' WHERE id = 'pvc_expansion_0_5';
UPDATE base_materials SET id = 'pvc34_exp' WHERE id = 'pvc_expansion_0_75';
UPDATE base_materials SET id = 'pvc1_exp' WHERE id = 'pvc_expansion_1';
UPDATE base_materials SET id = 'pvc114_exp' WHERE id = 'pvc_expansion_1_25';
UPDATE base_materials SET id = 'pvc112_exp' WHERE id = 'pvc_expansion_1_5';
UPDATE base_materials SET id = 'pvc2_exp' WHERE id = 'pvc_expansion_2';
UPDATE base_materials SET id = 'pvc212_exp' WHERE id = 'pvc_expansion_2_5';
UPDATE base_materials SET id = 'pvc3_exp' WHERE id = 'pvc_expansion_3';
UPDATE base_materials SET id = 'pvc4_exp' WHERE id = 'pvc_expansion_4';

-- LB Bodies
UPDATE base_materials SET id = 'pvc12_lb' WHERE id = 'pvc_lb_0_5';
UPDATE base_materials SET id = 'pvc34_lb' WHERE id = 'pvc_lb_0_75';
UPDATE base_materials SET id = 'pvc1_lb' WHERE id = 'pvc_lb_1';
UPDATE base_materials SET id = 'pvc114_lb' WHERE id = 'pvc_lb_1_25';
UPDATE base_materials SET id = 'pvc112_lb' WHERE id = 'pvc_lb_1_5';
UPDATE base_materials SET id = 'pvc2_lb' WHERE id = 'pvc_lb_2';
UPDATE base_materials SET id = 'pvc212_lb' WHERE id = 'pvc_lb_2_5';
UPDATE base_materials SET id = 'pvc3_lb' WHERE id = 'pvc_lb_3';
UPDATE base_materials SET id = 'pvc4_lb' WHERE id = 'pvc_lb_4';

-- LL Bodies
UPDATE base_materials SET id = 'pvc12_ll' WHERE id = 'pvc_ll_0_5';
UPDATE base_materials SET id = 'pvc34_ll' WHERE id = 'pvc_ll_0_75';
UPDATE base_materials SET id = 'pvc1_ll' WHERE id = 'pvc_ll_1';
UPDATE base_materials SET id = 'pvc114_ll' WHERE id = 'pvc_ll_1_25';
UPDATE base_materials SET id = 'pvc112_ll' WHERE id = 'pvc_ll_1_5';
UPDATE base_materials SET id = 'pvc2_ll' WHERE id = 'pvc_ll_2';
UPDATE base_materials SET id = 'pvc212_ll' WHERE id = 'pvc_ll_2_5';
UPDATE base_materials SET id = 'pvc3_ll' WHERE id = 'pvc_ll_3';
UPDATE base_materials SET id = 'pvc4_ll' WHERE id = 'pvc_ll_4';

-- LR Bodies
UPDATE base_materials SET id = 'pvc12_lr' WHERE id = 'pvc_lr_0_5';
UPDATE base_materials SET id = 'pvc34_lr' WHERE id = 'pvc_lr_0_75';
UPDATE base_materials SET id = 'pvc1_lr' WHERE id = 'pvc_lr_1';
UPDATE base_materials SET id = 'pvc114_lr' WHERE id = 'pvc_lr_1_25';
UPDATE base_materials SET id = 'pvc112_lr' WHERE id = 'pvc_lr_1_5';
UPDATE base_materials SET id = 'pvc2_lr' WHERE id = 'pvc_lr_2';
UPDATE base_materials SET id = 'pvc212_lr' WHERE id = 'pvc_lr_2_5';
UPDATE base_materials SET id = 'pvc3_lr' WHERE id = 'pvc_lr_3';
UPDATE base_materials SET id = 'pvc4_lr' WHERE id = 'pvc_lr_4';

-- Long-Sweep 90° Elbows
UPDATE base_materials SET id = 'pvc2_ls90' WHERE id = 'pvc_longsweep_90_2';
UPDATE base_materials SET id = 'pvc212_ls90' WHERE id = 'pvc_longsweep_90_2_5';
UPDATE base_materials SET id = 'pvc3_ls90' WHERE id = 'pvc_longsweep_90_3';
UPDATE base_materials SET id = 'pvc4_ls90' WHERE id = 'pvc_longsweep_90_4';

-- Reducers
UPDATE base_materials SET id = 'pvc34_red_12' WHERE id = 'pvc_reducer_0_75_to_0_5';
UPDATE base_materials SET id = 'pvc1_red_34' WHERE id = 'pvc_reducer_1_to_0_75';
UPDATE base_materials SET id = 'pvc114_red_1' WHERE id = 'pvc_reducer_1_25_to_1';
UPDATE base_materials SET id = 'pvc112_red_114' WHERE id = 'pvc_reducer_1_5_to_1_25';
UPDATE base_materials SET id = 'pvc2_red_112' WHERE id = 'pvc_reducer_2_to_1_5';
UPDATE base_materials SET id = 'pvc212_red_2' WHERE id = 'pvc_reducer_2_5_to_2';
UPDATE base_materials SET id = 'pvc3_red_212' WHERE id = 'pvc_reducer_3_to_2_5';
UPDATE base_materials SET id = 'pvc4_red_3' WHERE id = 'pvc_reducer_4_to_3';

COMMIT;

-- ================================================================
-- STEP 3: VERIFY Migration
-- ================================================================

SELECT 
  'PVC Fittings After Migration' as category,
  id,
  name,
  basecost
FROM base_materials
WHERE id LIKE 'pvc%' 
  AND (id LIKE '%_45' OR id LIKE '%_90' OR id LIKE '%_bell' OR id LIKE '%_bush' 
       OR id LIKE '%_exp' OR id LIKE '%_lb' OR id LIKE '%_ll' OR id LIKE '%_lr' 
       OR id LIKE '%_ls90' OR id LIKE '%_red_%')
ORDER BY id;

-- Count by type
SELECT 
  'Summary' as info,
  COUNT(*) FILTER (WHERE id LIKE '%_45') as elbows_45,
  COUNT(*) FILTER (WHERE id LIKE '%_90' AND id NOT LIKE '%_ls90') as elbows_90,
  COUNT(*) FILTER (WHERE id LIKE '%_ls90') as longsweep_90,
  COUNT(*) FILTER (WHERE id LIKE '%_bell') as bell_ends,
  COUNT(*) FILTER (WHERE id LIKE '%_bush') as bushings,
  COUNT(*) FILTER (WHERE id LIKE '%_exp') as expansion,
  COUNT(*) FILTER (WHERE id LIKE '%_lb') as lb_bodies,
  COUNT(*) FILTER (WHERE id LIKE '%_ll') as ll_bodies,
  COUNT(*) FILTER (WHERE id LIKE '%_lr') as lr_bodies,
  COUNT(*) FILTER (WHERE id LIKE '%_red_%') as reducers
FROM base_materials
WHERE id LIKE 'pvc%';

-- Check for old patterns
SELECT 
  'OLD PATTERNS REMAINING (Should be empty)' as warning,
  id,
  name
FROM base_materials
WHERE id LIKE 'pvc_45_%' OR id LIKE 'pvc_90_%' OR id LIKE 'pvc_bell_%' 
   OR id LIKE 'pvc_bushing_%' OR id LIKE 'pvc_expansion_%' 
   OR id LIKE 'pvc_lb_%' OR id LIKE 'pvc_ll_%' OR id LIKE 'pvc_lr_%'
   OR id LIKE 'pvc_longsweep_%' OR id LIKE 'pvc_reducer_%'
ORDER BY id;

-- ================================================================
-- MIGRATION COMPLETE
-- ================================================================
SELECT '✅ PVC Fittings ID Reorganization Complete!' as status;
