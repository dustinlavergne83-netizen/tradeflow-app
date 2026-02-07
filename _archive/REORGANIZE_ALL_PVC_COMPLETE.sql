-- ================================================================
-- COMPLETE PVC MATERIAL ID REORGANIZATION
-- ================================================================
-- This script migrates both base conduit AND fittings
-- Based on actual materials in database
-- ================================================================

-- ================================================================
-- PART 1: BASE CONDUIT PREVIEW
-- ================================================================

SELECT 
  'PVC Conduit (Sch 40 & 80)' as category,
  id as current_id,
  name,
  CASE
    -- Schedule 40
    WHEN id = 'pvc40_0_5' THEN 'pvc12_'
    WHEN id = 'pvc40_0_75' THEN 'pvc34_'
    WHEN id = 'pvc40_1' THEN 'pvc1_'
    WHEN id = 'pvc40_1_25' THEN 'pvc114_'
    WHEN id = 'pvc40_1_5' THEN 'pvc112_'
    WHEN id = 'pvc40_2' THEN 'pvc2_'
    WHEN id = 'pvc40_2_5' THEN 'pvc212_'
    WHEN id = 'pvc40_3' THEN 'pvc3_'
    WHEN id = 'pvc40_4' THEN 'pvc4_'
    -- Schedule 80
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
WHERE id LIKE 'pvc40_%' OR id LIKE 'pvc80_%'
ORDER BY id;

-- ================================================================
-- PART 2: FITTINGS PREVIEW (Partial - see full list below)
-- ================================================================

SELECT 
  'PVC Fittings Preview (Sample)' as category,
  COUNT(*) as total_fittings,
  COUNT(*) FILTER (WHERE id LIKE 'pvc_45_%') as elbows_45,
  COUNT(*) FILTER (WHERE id LIKE 'pvc_90_%') as elbows_90,
  COUNT(*) FILTER (WHERE id LIKE 'pvc_bell_%') as bell_ends,
  COUNT(*) FILTER (WHERE id LIKE 'pvc_bushing_%') as bushings,
  COUNT(*) FILTER (WHERE id LIKE 'pvc_lb_%') as lb_bodies
FROM base_materials
WHERE id LIKE 'pvc_%' 
  AND id NOT LIKE 'pvc40_%' 
  AND id NOT LIKE 'pvc80_%';

-- ================================================================
-- EXECUTE ALL MIGRATIONS
-- ================================================================

BEGIN;

-- ==== CONDUIT: Schedule 40 ====
UPDATE base_materials SET id = 'pvc12_' WHERE id = 'pvc40_0_5';
UPDATE base_materials SET id = 'pvc34_' WHERE id = 'pvc40_0_75';
UPDATE base_materials SET id = 'pvc1_' WHERE id = 'pvc40_1';
UPDATE base_materials SET id = 'pvc114_' WHERE id = 'pvc40_1_25';
UPDATE base_materials SET id = 'pvc112_' WHERE id = 'pvc40_1_5';
UPDATE base_materials SET id = 'pvc2_' WHERE id = 'pvc40_2';
UPDATE base_materials SET id = 'pvc212_' WHERE id = 'pvc40_2_5';
UPDATE base_materials SET id = 'pvc3_' WHERE id = 'pvc40_3';
UPDATE base_materials SET id = 'pvc4_' WHERE id = 'pvc40_4';

-- ==== CONDUIT: Schedule 80 ====
UPDATE base_materials SET id = 'pvc12_80_' WHERE id = 'pvc80_0_5';
UPDATE base_materials SET id = 'pvc34_80_' WHERE id = 'pvc80_0_75';
UPDATE base_materials SET id = 'pvc1_80_' WHERE id = 'pvc80_1';
UPDATE base_materials SET id = 'pvc114_80_' WHERE id = 'pvc80_1_25';
UPDATE base_materials SET id = 'pvc112_80_' WHERE id = 'pvc80_1_5';
UPDATE base_materials SET id = 'pvc2_80_' WHERE id = 'pvc80_2';
UPDATE base_materials SET id = 'pvc212_80_' WHERE id = 'pvc80_2_5';
UPDATE base_materials SET id = 'pvc3_80_' WHERE id = 'pvc80_3';
UPDATE base_materials SET id = 'pvc4_80_' WHERE id = 'pvc80_4';

-- ==== FITTINGS: 45° Elbows ====
UPDATE base_materials SET id = 'pvc12_45' WHERE id = 'pvc_45_0_5';
UPDATE base_materials SET id = 'pvc34_45' WHERE id = 'pvc_45_0_75';
UPDATE base_materials SET id = 'pvc1_45' WHERE id = 'pvc_45_1';
UPDATE base_materials SET id = 'pvc114_45' WHERE id = 'pvc_45_1_25';
UPDATE base_materials SET id = 'pvc112_45' WHERE id = 'pvc_45_1_5';
UPDATE base_materials SET id = 'pvc2_45' WHERE id = 'pvc_45_2';
UPDATE base_materials SET id = 'pvc212_45' WHERE id = 'pvc_45_2_5';
UPDATE base_materials SET id = 'pvc3_45' WHERE id = 'pvc_45_3';
UPDATE base_materials SET id = 'pvc4_45' WHERE id = 'pvc_45_4';

-- ==== FITTINGS: 90° Elbows ====
UPDATE base_materials SET id = 'pvc12_90' WHERE id = 'pvc_90_0_5';
UPDATE base_materials SET id = 'pvc34_90' WHERE id = 'pvc_90_0_75';
UPDATE base_materials SET id = 'pvc1_90' WHERE id = 'pvc_90_1';
UPDATE base_materials SET id = 'pvc114_90' WHERE id = 'pvc_90_1_25';
UPDATE base_materials SET id = 'pvc112_90' WHERE id = 'pvc_90_1_5';
UPDATE base_materials SET id = 'pvc2_90' WHERE id = 'pvc_90_2';
UPDATE base_materials SET id = 'pvc212_90' WHERE id = 'pvc_90_2_5';
UPDATE base_materials SET id = 'pvc3_90' WHERE id = 'pvc_90_3';
UPDATE base_materials SET id = 'pvc4_90' WHERE id = 'pvc_90_4';

-- ==== FITTINGS: Bell Ends ====
UPDATE base_materials SET id = 'pvc12_bell' WHERE id = 'pvc_bell_0_5';
UPDATE base_materials SET id = 'pvc34_bell' WHERE id = 'pvc_bell_0_75';
UPDATE base_materials SET id = 'pvc1_bell' WHERE id = 'pvc_bell_1';
UPDATE base_materials SET id = 'pvc114_bell' WHERE id = 'pvc_bell_1_25';
UPDATE base_materials SET id = 'pvc112_bell' WHERE id = 'pvc_bell_1_5';
UPDATE base_materials SET id = 'pvc2_bell' WHERE id = 'pvc_bell_2';
UPDATE base_materials SET id = 'pvc212_bell' WHERE id = 'pvc_bell_2_5';
UPDATE base_materials SET id = 'pvc3_bell' WHERE id = 'pvc_bell_3';
UPDATE base_materials SET id = 'pvc4_bell' WHERE id = 'pvc_bell_4';

-- ==== FITTINGS: Bushings ====
UPDATE base_materials SET id = 'pvc12_bush' WHERE id = 'pvc_bushing_0_5';
UPDATE base_materials SET id = 'pvc34_bush' WHERE id = 'pvc_bushing_0_75';
UPDATE base_materials SET id = 'pvc1_bush' WHERE id = 'pvc_bushing_1';
UPDATE base_materials SET id = 'pvc114_bush' WHERE id = 'pvc_bushing_1_25';
UPDATE base_materials SET id = 'pvc112_bush' WHERE id = 'pvc_bushing_1_5';
UPDATE base_materials SET id = 'pvc2_bush' WHERE id = 'pvc_bushing_2';
UPDATE base_materials SET id = 'pvc212_bush' WHERE id = 'pvc_bushing_2_5';
UPDATE base_materials SET id = 'pvc3_bush' WHERE id = 'pvc_bushing_3';
UPDATE base_materials SET id = 'pvc4_bush' WHERE id = 'pvc_bushing_4';

-- ==== FITTINGS: Expansion Fittings ====
UPDATE base_materials SET id = 'pvc12_exp' WHERE id = 'pvc_expansion_0_5';
UPDATE base_materials SET id = 'pvc34_exp' WHERE id = 'pvc_expansion_0_75';
UPDATE base_materials SET id = 'pvc1_exp' WHERE id = 'pvc_expansion_1';
UPDATE base_materials SET id = 'pvc114_exp' WHERE id = 'pvc_expansion_1_25';
UPDATE base_materials SET id = 'pvc112_exp' WHERE id = 'pvc_expansion_1_5';
UPDATE base_materials SET id = 'pvc2_exp' WHERE id = 'pvc_expansion_2';
UPDATE base_materials SET id = 'pvc212_exp' WHERE id = 'pvc_expansion_2_5';
UPDATE base_materials SET id = 'pvc3_exp' WHERE id = 'pvc_expansion_3';
UPDATE base_materials SET id = 'pvc4_exp' WHERE id = 'pvc_expansion_4';

-- ==== FITTINGS: LB Bodies ====
UPDATE base_materials SET id = 'pvc12_lb' WHERE id = 'pvc_lb_0_5';
UPDATE base_materials SET id = 'pvc34_lb' WHERE id = 'pvc_lb_0_75';
UPDATE base_materials SET id = 'pvc1_lb' WHERE id = 'pvc_lb_1';
UPDATE base_materials SET id = 'pvc114_lb' WHERE id = 'pvc_lb_1_25';
UPDATE base_materials SET id = 'pvc112_lb' WHERE id = 'pvc_lb_1_5';
UPDATE base_materials SET id = 'pvc2_lb' WHERE id = 'pvc_lb_2';
UPDATE base_materials SET id = 'pvc212_lb' WHERE id = 'pvc_lb_2_5';
UPDATE base_materials SET id = 'pvc3_lb' WHERE id = 'pvc_lb_3';
UPDATE base_materials SET id = 'pvc4_lb' WHERE id = 'pvc_lb_4';

-- ==== FITTINGS: LL Bodies ====
UPDATE base_materials SET id = 'pvc12_ll' WHERE id = 'pvc_ll_0_5';
UPDATE base_materials SET id = 'pvc34_ll' WHERE id = 'pvc_ll_0_75';
UPDATE base_materials SET id = 'pvc1_ll' WHERE id = 'pvc_ll_1';
UPDATE base_materials SET id = 'pvc114_ll' WHERE id = 'pvc_ll_1_25';
UPDATE base_materials SET id = 'pvc112_ll' WHERE id = 'pvc_ll_1_5';
UPDATE base_materials SET id = 'pvc2_ll' WHERE id = 'pvc_ll_2';
UPDATE base_materials SET id = 'pvc212_ll' WHERE id = 'pvc_ll_2_5';
UPDATE base_materials SET id = 'pvc3_ll' WHERE id = 'pvc_ll_3';
UPDATE base_materials SET id = 'pvc4_ll' WHERE id = 'pvc_ll_4';

-- ==== FITTINGS: LR Bodies ====
UPDATE base_materials SET id = 'pvc12_lr' WHERE id = 'pvc_lr_0_5';
UPDATE base_materials SET id = 'pvc34_lr' WHERE id = 'pvc_lr_0_75';
UPDATE base_materials SET id = 'pvc1_lr' WHERE id = 'pvc_lr_1';
UPDATE base_materials SET id = 'pvc114_lr' WHERE id = 'pvc_lr_1_25';
UPDATE base_materials SET id = 'pvc112_lr' WHERE id = 'pvc_lr_1_5';
UPDATE base_materials SET id = 'pvc2_lr' WHERE id = 'pvc_lr_2';
UPDATE base_materials SET id = 'pvc212_lr' WHERE id = 'pvc_lr_2_5';
UPDATE base_materials SET id = 'pvc3_lr' WHERE id = 'pvc_lr_3';
UPDATE base_materials SET id = 'pvc4_lr' WHERE id = 'pvc_lr_4';

-- ==== FITTINGS: Long-Sweep 90° Elbows ====
UPDATE base_materials SET id = 'pvc2_ls90' WHERE id = 'pvc_longsweep_90_2';
UPDATE base_materials SET id = 'pvc212_ls90' WHERE id = 'pvc_longsweep_90_2_5';
UPDATE base_materials SET id = 'pvc3_ls90' WHERE id = 'pvc_longsweep_90_3';
UPDATE base_materials SET id = 'pvc4_ls90' WHERE id = 'pvc_longsweep_90_4';

-- ==== FITTINGS: Reducers ====
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
-- VERIFICATION
-- ================================================================

-- Base Conduit Summary
SELECT 
  'PVC CONDUIT (After Migration)' as category,
  COUNT(*) FILTER (WHERE id LIKE 'pvc%_' AND id NOT LIKE '%_80_%') as sch_40,
  COUNT(*) FILTER (WHERE id LIKE 'pvc%_80_') as sch_80,
  COUNT(*) as total_conduit
FROM base_materials
WHERE (id LIKE 'pvc%_' OR id LIKE 'pvc%_80_')
  AND id NOT LIKE 'pvc_%_%';

-- Fittings Summary
SELECT 
  'PVC FITTINGS (After Migration)' as category,
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

-- Sample of migrated materials
SELECT 
  'SAMPLE MIGRATED MATERIALS' as info,
  id,
  name,
  basecost
FROM base_materials
WHERE id LIKE 'pvc%'
ORDER BY id
LIMIT 20;

-- Check for old patterns (should all be empty)
SELECT 
  'OLD CONDUIT PATTERNS (Should be empty)' as warning,
  COUNT(*) as count
FROM base_materials
WHERE id LIKE 'pvc40_%' OR id LIKE 'pvc80_%';

SELECT 
  'OLD FITTING PATTERNS (Should be empty)' as warning,
  COUNT(*) as count
FROM base_materials
WHERE id LIKE 'pvc_45_%' OR id LIKE 'pvc_90_%' OR id LIKE 'pvc_bell_%' 
   OR id LIKE 'pvc_bushing_%' OR id LIKE 'pvc_expansion_%' 
   OR id LIKE 'pvc_lb_%' OR id LIKE 'pvc_ll_%' OR id LIKE 'pvc_lr_%'
   OR id LIKE 'pvc_longsweep_%' OR id LIKE 'pvc_reducer_%';

-- ================================================================
-- MIGRATION COMPLETE!
-- ================================================================
SELECT '✅ Complete PVC Material ID Reorganization Done!' as status,
       'Search "pvc12_" to find ALL 1/2" materials' as tip1,
       'Search "pvc12_80" to find ONLY 1/2" Sch 80' as tip2,
       'Search "_90" to find ALL 90° elbows' as tip3;
