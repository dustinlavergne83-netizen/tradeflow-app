-- ================================================================
-- REORGANIZE RIGID CONDUIT MATERIAL IDs
-- ================================================================
-- Pattern: rig12_ for base, rig12_cpl for fittings, rig12_strap_1h for straps
-- Following same format as EMT and PVC
-- ================================================================

-- ================================================================
-- STEP 1: PREVIEW - Show what will be migrated
-- ================================================================

SELECT 
  'RIGID Conduit' as category,
  id as current_id,
  name,
  CASE
    WHEN id = 'rigid_0_5' THEN 'rig12_'
    WHEN id = 'rigid_0_75' THEN 'rig34_'
    WHEN id = 'rigid_1' THEN 'rig1_'
    WHEN id = 'rigid_1_25' THEN 'rig114_'
    WHEN id = 'rigid_1_5' THEN 'rig112_'
    WHEN id = 'rigid_2' THEN 'rig2_'
    WHEN id = 'rigid_2_5' THEN 'rig212_'
    WHEN id = 'rigid_3' THEN 'rig3_'
    WHEN id = 'rigid_4' THEN 'rig4_'
    ELSE 'ERROR: ' || id
  END as new_id
FROM base_materials
WHERE id IN ('rigid_0_5', 'rigid_0_75', 'rigid_1', 'rigid_1_25', 'rigid_1_5', 'rigid_2', 'rigid_2_5', 'rigid_3', 'rigid_4')
ORDER BY id;

-- Preview fittings (sample)
SELECT 
  'RIGID Fittings (Sample)' as category,
  COUNT(*) as total_fittings,
  COUNT(*) FILTER (WHERE id LIKE 'rigid_45_%') as elbows_45,
  COUNT(*) FILTER (WHERE id LIKE 'rigid_90_%') as elbows_90,
  COUNT(*) FILTER (WHERE id LIKE 'rigid_cpl_%') as couplings,
  COUNT(*) FILTER (WHERE id LIKE 'rigid_strap%') as straps,
  COUNT(*) FILTER (WHERE id LIKE 'unistrut_rigid_%') as unistrut_straps
FROM base_materials
WHERE id LIKE 'rigid_%' OR id LIKE 'unistrut_rigid_%';

-- ================================================================
-- EXECUTE ALL MIGRATIONS
-- ================================================================

BEGIN;

-- ==== BASE CONDUIT ====
UPDATE base_materials SET id = 'rig12_' WHERE id = 'rigid_0_5';
UPDATE base_materials SET id = 'rig34_' WHERE id = 'rigid_0_75';
UPDATE base_materials SET id = 'rig1_' WHERE id = 'rigid_1';
UPDATE base_materials SET id = 'rig114_' WHERE id = 'rigid_1_25';
UPDATE base_materials SET id = 'rig112_' WHERE id = 'rigid_1_5';
UPDATE base_materials SET id = 'rig2_' WHERE id = 'rigid_2';
UPDATE base_materials SET id = 'rig212_' WHERE id = 'rigid_2_5';
UPDATE base_materials SET id = 'rig3_' WHERE id = 'rigid_3';
UPDATE base_materials SET id = 'rig4_' WHERE id = 'rigid_4';

-- ==== 45° ELBOWS ====
UPDATE base_materials SET id = 'rig12_45' WHERE id = 'rigid_45_0_5';
UPDATE base_materials SET id = 'rig34_45' WHERE id = 'rigid_45_0_75';
UPDATE base_materials SET id = 'rig1_45' WHERE id = 'rigid_45_1';
UPDATE base_materials SET id = 'rig114_45' WHERE id = 'rigid_45_1_25';
UPDATE base_materials SET id = 'rig112_45' WHERE id = 'rigid_45_1_5';
UPDATE base_materials SET id = 'rig2_45' WHERE id = 'rigid_45_2';
UPDATE base_materials SET id = 'rig212_45' WHERE id = 'rigid_45_2_5';
UPDATE base_materials SET id = 'rig3_45' WHERE id = 'rigid_45_3';
UPDATE base_materials SET id = 'rig4_45' WHERE id = 'rigid_45_4';

-- ==== 90° ELBOWS ====
UPDATE base_materials SET id = 'rig12_90' WHERE id = 'rigid_90_0_5';
UPDATE base_materials SET id = 'rig34_90' WHERE id = 'rigid_90_0_75';
UPDATE base_materials SET id = 'rig1_90' WHERE id = 'rigid_90_1';
UPDATE base_materials SET id = 'rig114_90' WHERE id = 'rigid_90_1_25';
UPDATE base_materials SET id = 'rig112_90' WHERE id = 'rigid_90_1_5';
UPDATE base_materials SET id = 'rig2_90' WHERE id = 'rigid_90_2';
UPDATE base_materials SET id = 'rig212_90' WHERE id = 'rigid_90_2_5';
UPDATE base_materials SET id = 'rig3_90' WHERE id = 'rigid_90_3';
UPDATE base_materials SET id = 'rig4_90' WHERE id = 'rigid_90_4';

-- ==== COUPLINGS (Threaded) ====
UPDATE base_materials SET id = 'rig12_cpl' WHERE id = 'rigid_cpl_0_5';
UPDATE base_materials SET id = 'rig34_cpl' WHERE id = 'rigid_cpl_0_75';
UPDATE base_materials SET id = 'rig1_cpl' WHERE id = 'rigid_cpl_1';
UPDATE base_materials SET id = 'rig114_cpl' WHERE id = 'rigid_cpl_1_25';
UPDATE base_materials SET id = 'rig112_cpl' WHERE id = 'rigid_cpl_1_5';
UPDATE base_materials SET id = 'rig2_cpl' WHERE id = 'rigid_cpl_2';
UPDATE base_materials SET id = 'rig212_cpl' WHERE id = 'rigid_cpl_2_5';
UPDATE base_materials SET id = 'rig3_cpl' WHERE id = 'rigid_cpl_3';
UPDATE base_materials SET id = 'rig4_cpl' WHERE id = 'rigid_cpl_4';

-- ==== THREADLESS CONNECTORS ====
UPDATE base_materials SET id = 'rig12_conn_tl' WHERE id = 'rigid_threadless_conn_0_5';
UPDATE base_materials SET id = 'rig34_conn_tl' WHERE id = 'rigid_threadless_conn_0_75';
UPDATE base_materials SET id = 'rig1_conn_tl' WHERE id = 'rigid_threadless_conn_1';
UPDATE base_materials SET id = 'rig114_conn_tl' WHERE id = 'rigid_threadless_conn_1_25';
UPDATE base_materials SET id = 'rig112_conn_tl' WHERE id = 'rigid_threadless_conn_1_5';
UPDATE base_materials SET id = 'rig2_conn_tl' WHERE id = 'rigid_threadless_conn_2';
UPDATE base_materials SET id = 'rig212_conn_tl' WHERE id = 'rigid_threadless_conn_2_5';
UPDATE base_materials SET id = 'rig3_conn_tl' WHERE id = 'rigid_threadless_conn_3';
UPDATE base_materials SET id = 'rig4_conn_tl' WHERE id = 'rigid_threadless_conn_4';

-- ==== THREADLESS COUPLINGS ====
UPDATE base_materials SET id = 'rig12_cpl_tl' WHERE id = 'rigid_threadless_cpl_0_5';
UPDATE base_materials SET id = 'rig34_cpl_tl' WHERE id = 'rigid_threadless_cpl_0_75';
UPDATE base_materials SET id = 'rig1_cpl_tl' WHERE id = 'rigid_threadless_cpl_1';
UPDATE base_materials SET id = 'rig114_cpl_tl' WHERE id = 'rigid_threadless_cpl_1_25';
UPDATE base_materials SET id = 'rig112_cpl_tl' WHERE id = 'rigid_threadless_cpl_1_5';
UPDATE base_materials SET id = 'rig2_cpl_tl' WHERE id = 'rigid_threadless_cpl_2';
UPDATE base_materials SET id = 'rig212_cpl_tl' WHERE id = 'rigid_threadless_cpl_2_5';
UPDATE base_materials SET id = 'rig3_cpl_tl' WHERE id = 'rigid_threadless_cpl_3';
UPDATE base_materials SET id = 'rig4_cpl_tl' WHERE id = 'rigid_threadless_cpl_4';

-- ==== UNISTRUT STRAPS ====
UPDATE base_materials SET id = 'rig12_strap_uni' WHERE id = 'unistrut_rigid_0_5';
UPDATE base_materials SET id = 'rig34_strap_uni' WHERE id = 'unistrut_rigid_0_75';
UPDATE base_materials SET id = 'rig1_strap_uni' WHERE id = 'unistrut_rigid_1';
UPDATE base_materials SET id = 'rig114_strap_uni' WHERE id = 'unistrut_rigid_1_25';
UPDATE base_materials SET id = 'rig112_strap_uni' WHERE id = 'unistrut_rigid_1_5';
UPDATE base_materials SET id = 'rig2_strap_uni' WHERE id = 'unistrut_rigid_2';
UPDATE base_materials SET id = 'rig212_strap_uni' WHERE id = 'unistrut_rigid_2_5';
UPDATE base_materials SET id = 'rig3_strap_uni' WHERE id = 'unistrut_rigid_3';
UPDATE base_materials SET id = 'rig4_strap_uni' WHERE id = 'unistrut_rigid_4';

-- ==== 1-HOLE STRAPS ====
UPDATE base_materials SET id = 'rig12_strap_1h' WHERE id = 'rigid_strap1_1_2';
UPDATE base_materials SET id = 'rig34_strap_1h' WHERE id = 'rigid_strap1_3_4';
UPDATE base_materials SET id = 'rig1_strap_1h' WHERE id = 'rigid_strap1_1';
UPDATE base_materials SET id = 'rig114_strap_1h' WHERE id = 'rigid_strap1_1_1_4';
UPDATE base_materials SET id = 'rig112_strap_1h' WHERE id = 'rigid_strap1_1_1_2';
UPDATE base_materials SET id = 'rig2_strap_1h' WHERE id = 'rigid_strap1_2';
UPDATE base_materials SET id = 'rig212_strap_1h' WHERE id = 'rigid_strap1_2_1_2';
UPDATE base_materials SET id = 'rig3_strap_1h' WHERE id = 'rigid_strap1_3';
UPDATE base_materials SET id = 'rig4_strap_1h' WHERE id = 'rigid_strap1_4';

-- ==== 2-HOLE STRAPS ====
UPDATE base_materials SET id = 'rig12_strap_2h' WHERE id = 'rigid_strap2_1_2';
UPDATE base_materials SET id = 'rig34_strap_2h' WHERE id = 'rigid_strap2_3_4';
UPDATE base_materials SET id = 'rig1_strap_2h' WHERE id = 'rigid_strap2_1';
UPDATE base_materials SET id = 'rig114_strap_2h' WHERE id = 'rigid_strap2_1_1_4';
UPDATE base_materials SET id = 'rig112_strap_2h' WHERE id = 'rigid_strap2_1_1_2';
UPDATE base_materials SET id = 'rig2_strap_2h' WHERE id = 'rigid_strap2_2';
UPDATE base_materials SET id = 'rig212_strap_2h' WHERE id = 'rigid_strap2_2_1_2';
UPDATE base_materials SET id = 'rig3_strap_2h' WHERE id = 'rigid_strap2_3';
UPDATE base_materials SET id = 'rig4_strap_2h' WHERE id = 'rigid_strap2_4';

-- ==== STANDOFF STRAPS ====
UPDATE base_materials SET id = 'rig12_standoff' WHERE id = 'rigid_standoff_0_5';
UPDATE base_materials SET id = 'rig34_standoff' WHERE id = 'rigid_standoff_0_75';
UPDATE base_materials SET id = 'rig1_standoff' WHERE id = 'rigid_standoff_1';
UPDATE base_materials SET id = 'rig114_standoff' WHERE id = 'rigid_standoff_1_25';
UPDATE base_materials SET id = 'rig112_standoff' WHERE id = 'rigid_standoff_1_5';
UPDATE base_materials SET id = 'rig2_standoff' WHERE id = 'rigid_standoff_2';
UPDATE base_materials SET id = 'rig212_standoff' WHERE id = 'rigid_standoff_2_5';
UPDATE base_materials SET id = 'rig3_standoff' WHERE id = 'rigid_standoff_3';
UPDATE base_materials SET id = 'rig4_standoff' WHERE id = 'rigid_standoff_4';
UPDATE base_materials SET id = 'rig5_standoff' WHERE id = 'rigid_standoff_5';

-- ==== CLOSE NIPPLES ====
UPDATE base_materials SET id = 'rig12_nip_close' WHERE id = 'rigid_nip_close_0_5';
UPDATE base_materials SET id = 'rig34_nip_close' WHERE id = 'rigid_nip_close_0_75';
UPDATE base_materials SET id = 'rig1_nip_close' WHERE id = 'rigid_nip_close_1';
UPDATE base_materials SET id = 'rig114_nip_close' WHERE id = 'rigid_nip_close_1_25';
UPDATE base_materials SET id = 'rig112_nip_close' WHERE id = 'rigid_nip_close_1_5';
UPDATE base_materials SET id = 'rig2_nip_close' WHERE id = 'rigid_nip_close_2';
UPDATE base_materials SET id = 'rig212_nip_close' WHERE id = 'rigid_nip_close_2_5';
UPDATE base_materials SET id = 'rig3_nip_close' WHERE id = 'rigid_nip_close_3';
UPDATE base_materials SET id = 'rig4_nip_close' WHERE id = 'rigid_nip_close_4';

-- ==== 2" NIPPLES ====
UPDATE base_materials SET id = 'rig12_nip_2in' WHERE id = 'rigid_nip_2in_0_5';
UPDATE base_materials SET id = 'rig34_nip_2in' WHERE id = 'rigid_nip_2in_0_75';
UPDATE base_materials SET id = 'rig1_nip_2in' WHERE id = 'rigid_nip_2in_1';
UPDATE base_materials SET id = 'rig114_nip_2in' WHERE id = 'rigid_nip_2in_1_25';
UPDATE base_materials SET id = 'rig112_nip_2in' WHERE id = 'rigid_nip_2in_1_5';
UPDATE base_materials SET id = 'rig2_nip_2in' WHERE id = 'rigid_nip_2in_2';
UPDATE base_materials SET id = 'rig212_nip_2in' WHERE id = 'rigid_nip_2in_2_5';
UPDATE base_materials SET id = 'rig3_nip_2in' WHERE id = 'rigid_nip_2in_3';
UPDATE base_materials SET id = 'rig4_nip_2in' WHERE id = 'rigid_nip_2in_4';

-- ==== 4" NIPPLES ====
UPDATE base_materials SET id = 'rig12_nip_4in' WHERE id = 'rigid_nip_4in_0_5';
UPDATE base_materials SET id = 'rig34_nip_4in' WHERE id = 'rigid_nip_4in_0_75';
UPDATE base_materials SET id = 'rig1_nip_4in' WHERE id = 'rigid_nip_4in_1';
UPDATE base_materials SET id = 'rig114_nip_4in' WHERE id = 'rigid_nip_4in_1_25';
UPDATE base_materials SET id = 'rig112_nip_4in' WHERE id = 'rigid_nip_4in_1_5';
UPDATE base_materials SET id = 'rig2_nip_4in' WHERE id = 'rigid_nip_4in_2';
UPDATE base_materials SET id = 'rig212_nip_4in' WHERE id = 'rigid_nip_4in_2_5';
UPDATE base_materials SET id = 'rig3_nip_4in' WHERE id = 'rigid_nip_4in_3';
UPDATE base_materials SET id = 'rig4_nip_4in' WHERE id = 'rigid_nip_4in_4';

-- ==== 6" NIPPLES ====
UPDATE base_materials SET id = 'rig12_nip_6in' WHERE id = 'rigid_nip_6in_0_5';
UPDATE base_materials SET id = 'rig34_nip_6in' WHERE id = 'rigid_nip_6in_0_75';
UPDATE base_materials SET id = 'rig1_nip_6in' WHERE id = 'rigid_nip_6in_1';
UPDATE base_materials SET id = 'rig114_nip_6in' WHERE id = 'rigid_nip_6in_1_25';
UPDATE base_materials SET id = 'rig112_nip_6in' WHERE id = 'rigid_nip_6in_1_5';
UPDATE base_materials SET id = 'rig2_nip_6in' WHERE id = 'rigid_nip_6in_2';
UPDATE base_materials SET id = 'rig212_nip_6in' WHERE id = 'rigid_nip_6in_2_5';
UPDATE base_materials SET id = 'rig3_nip_6in' WHERE id = 'rigid_nip_6in_3';
UPDATE base_materials SET id = 'rig4_nip_6in' WHERE id = 'rigid_nip_6in_4';

-- ==== 8" NIPPLES ====
UPDATE base_materials SET id = 'rig12_nip_8in' WHERE id = 'rigid_nip_8in_0_5';
UPDATE base_materials SET id = 'rig34_nip_8in' WHERE id = 'rigid_nip_8in_0_75';
UPDATE base_materials SET id = 'rig1_nip_8in' WHERE id = 'rigid_nip_8in_1';
UPDATE base_materials SET id = 'rig114_nip_8in' WHERE id = 'rigid_nip_8in_1_25';
UPDATE base_materials SET id = 'rig112_nip_8in' WHERE id = 'rigid_nip_8in_1_5';
UPDATE base_materials SET id = 'rig2_nip_8in' WHERE id = 'rigid_nip_8in_2';
UPDATE base_materials SET id = 'rig212_nip_8in' WHERE id = 'rigid_nip_8in_2_5';
UPDATE base_materials SET id = 'rig3_nip_8in' WHERE id = 'rigid_nip_8in_3';
UPDATE base_materials SET id = 'rig4_nip_8in' WHERE id = 'rigid_nip_8in_4';

-- ==== 12" NIPPLES ====
UPDATE base_materials SET id = 'rig12_nip_12in' WHERE id = 'rigid_nip_12in_0_5';
UPDATE base_materials SET id = 'rig34_nip_12in' WHERE id = 'rigid_nip_12in_0_75';
UPDATE base_materials SET id = 'rig1_nip_12in' WHERE id = 'rigid_nip_12in_1';
UPDATE base_materials SET id = 'rig114_nip_12in' WHERE id = 'rigid_nip_12in_1_25';
UPDATE base_materials SET id = 'rig112_nip_12in' WHERE id = 'rigid_nip_12in_1_5';
UPDATE base_materials SET id = 'rig2_nip_12in' WHERE id = 'rigid_nip_12in_2';
UPDATE base_materials SET id = 'rig212_nip_12in' WHERE id = 'rigid_nip_12in_2_5';
UPDATE base_materials SET id = 'rig3_nip_12in' WHERE id = 'rigid_nip_12in_3';
UPDATE base_materials SET id = 'rig4_nip_12in' WHERE id = 'rigid_nip_12in_4';

-- ==== 18" NIPPLES ====
UPDATE base_materials SET id = 'rig12_nip_18in' WHERE id = 'rigid_nip_18in_0_5';
UPDATE base_materials SET id = 'rig34_nip_18in' WHERE id = 'rigid_nip_18in_0_75';
UPDATE base_materials SET id = 'rig1_nip_18in' WHERE id = 'rigid_nip_18in_1';
UPDATE base_materials SET id = 'rig114_nip_18in' WHERE id = 'rigid_nip_18in_1_25';
UPDATE base_materials SET id = 'rig112_nip_18in' WHERE id = 'rigid_nip_18in_1_5';
UPDATE base_materials SET id = 'rig2_nip_18in' WHERE id = 'rigid_nip_18in_2';
UPDATE base_materials SET id = 'rig212_nip_18in' WHERE id = 'rigid_nip_18in_2_5';
UPDATE base_materials SET id = 'rig3_nip_18in' WHERE id = 'rigid_nip_18in_3';
UPDATE base_materials SET id = 'rig4_nip_18in' WHERE id = 'rigid_nip_18in_4';

-- ==== 24" NIPPLES ====
UPDATE base_materials SET id = 'rig12_nip_24in' WHERE id = 'rigid_nip_24in_0_5';
UPDATE base_materials SET id = 'rig34_nip_24in' WHERE id = 'rigid_nip_24in_0_75';
UPDATE base_materials SET id = 'rig1_nip_24in' WHERE id = 'rigid_nip_24in_1';
UPDATE base_materials SET id = 'rig114_nip_24in' WHERE id = 'rigid_nip_24in_1_25';
UPDATE base_materials SET id = 'rig112_nip_24in' WHERE id = 'rigid_nip_24in_1_5';
UPDATE base_materials SET id = 'rig2_nip_24in' WHERE id = 'rigid_nip_24in_2';
UPDATE base_materials SET id = 'rig212_nip_24in' WHERE id = 'rigid_nip_24in_2_5';
UPDATE base_materials SET id = 'rig3_nip_24in' WHERE id = 'rigid_nip_24in_3';
UPDATE base_materials SET id = 'rig4_nip_24in' WHERE id = 'rigid_nip_24in_4';

COMMIT;

-- ================================================================
-- VERIFICATION
-- ================================================================

-- Summary by type
SELECT 
  'RIGID Migration Summary' as report,
  COUNT(*) FILTER (WHERE id LIKE 'rig%_' AND id NOT LIKE 'rig%_%') as base_conduit,
  COUNT(*) FILTER (WHERE id LIKE '%_45') as elbows_45,
  COUNT(*) FILTER (WHERE id LIKE '%_90') as elbows_90,
  COUNT(*) FILTER (WHERE id LIKE '%_cpl' AND id NOT LIKE '%_cpl_tl') as couplings_threaded,
  COUNT(*) FILTER (WHERE id LIKE '%_cpl_tl') as couplings_threadless,
  COUNT(*) FILTER (WHERE id LIKE '%_conn_tl') as connectors_threadless,
  COUNT(*) FILTER (WHERE id LIKE '%_strap_uni') as straps_unistrut,
  COUNT(*) FILTER (WHERE id LIKE '%_strap_1h') as straps_1hole,
  COUNT(*) FILTER (WHERE id LIKE '%_strap_2h') as straps_2hole,
  COUNT(*) FILTER (WHERE id LIKE '%_standoff') as standoffs,
  COUNT(*) FILTER (WHERE id LIKE '%_nip_%') as nipples
FROM base_materials
WHERE id LIKE 'rig%';

-- Sample of migrated materials
SELECT 
  'Sample Migrated RIGID Materials' as info,
  id,
  name,
  basecost
FROM base_materials
WHERE id LIKE 'rig%'
ORDER BY id
LIMIT 25;

-- Check for old patterns
SELECT 
  'OLD PATTERNS (Should be empty)' as warning,
  COUNT(*) as count
FROM base_materials
WHERE id LIKE 'rigid_%' OR id LIKE 'unistrut_rigid_%';

-- ================================================================
-- MIGRATION COMPLETE!
-- ================================================================
SELECT '✅ RIGID Conduit Material ID Reorganization Complete!' as status,
       'Search "rig12_" to find ALL 1/2" rigid materials' as tip1,
       'Search "rig12_strap" to find ALL 1/2" straps' as tip2,
       'Search "_cpl" to find ALL couplings across all conduit types' as tip3;
