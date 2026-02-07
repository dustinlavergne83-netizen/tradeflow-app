-- ================================================================
-- REORGANIZE IMC CONDUIT MATERIAL IDs
-- ================================================================
-- Pattern: imc12_ for 10ft stick, imc12_ft for per-foot pricing
-- Following same format as EMT, PVC, and RIGID
-- ================================================================

-- ================================================================
-- STEP 1: PREVIEW - Show what will be migrated
-- ================================================================

-- Base conduit (10ft sticks)
SELECT 
  'IMC Base Conduit (10ft sticks)' as category,
  id as current_id,
  name,
  CASE
    WHEN id = 'imc_0_5' THEN 'imc12_'
    WHEN id = 'imc_0_75' THEN 'imc34_'
    WHEN id = 'imc_1' THEN 'imc1_'
    WHEN id = 'imc_1_25' THEN 'imc114_'
    WHEN id = 'imc_1_5' THEN 'imc112_'
    WHEN id = 'imc_2' THEN 'imc2_'
    WHEN id = 'imc_2_5' THEN 'imc212_'
    WHEN id = 'imc_3' THEN 'imc3_'
    WHEN id = 'imc_4' THEN 'imc4_'
    ELSE 'ERROR: ' || id
  END as new_id
FROM base_materials
WHERE id IN ('imc_0_5', 'imc_0_75', 'imc_1', 'imc_1_25', 'imc_1_5', 'imc_2', 'imc_2_5', 'imc_3', 'imc_4')
ORDER BY id;

-- Per-foot conduit
SELECT 
  'IMC Conduit (per foot)' as category,
  id as current_id,
  name,
  CASE
    WHEN id = 'imc_conduit_0_5' THEN 'imc12_ft'
    WHEN id = 'imc_conduit_0_75' THEN 'imc34_ft'
    WHEN id = 'imc_conduit_1' THEN 'imc1_ft'
    WHEN id = 'imc_conduit_1_25' THEN 'imc114_ft'
    WHEN id = 'imc_conduit_1_5' THEN 'imc112_ft'
    WHEN id = 'imc_conduit_2' THEN 'imc2_ft'
    WHEN id = 'imc_conduit_2_5' THEN 'imc212_ft'
    WHEN id = 'imc_conduit_3' THEN 'imc3_ft'
    WHEN id = 'imc_conduit_4' THEN 'imc4_ft'
    ELSE 'ERROR: ' || id
  END as new_id
FROM base_materials
WHERE id LIKE 'imc_conduit_%'
ORDER BY id;

-- ================================================================
-- EXECUTE ALL MIGRATIONS
-- ================================================================

BEGIN;

-- ==== BASE CONDUIT (10ft sticks) ====
UPDATE base_materials SET id = 'imc12_' WHERE id = 'imc_0_5';
UPDATE base_materials SET id = 'imc34_' WHERE id = 'imc_0_75';
UPDATE base_materials SET id = 'imc1_' WHERE id = 'imc_1';
UPDATE base_materials SET id = 'imc114_' WHERE id = 'imc_1_25';
UPDATE base_materials SET id = 'imc112_' WHERE id = 'imc_1_5';
UPDATE base_materials SET id = 'imc2_' WHERE id = 'imc_2';
UPDATE base_materials SET id = 'imc212_' WHERE id = 'imc_2_5';
UPDATE base_materials SET id = 'imc3_' WHERE id = 'imc_3';
UPDATE base_materials SET id = 'imc4_' WHERE id = 'imc_4';

-- ==== CONDUIT PER FOOT ====
UPDATE base_materials SET id = 'imc12_ft' WHERE id = 'imc_conduit_0_5';
UPDATE base_materials SET id = 'imc34_ft' WHERE id = 'imc_conduit_0_75';
UPDATE base_materials SET id = 'imc1_ft' WHERE id = 'imc_conduit_1';
UPDATE base_materials SET id = 'imc114_ft' WHERE id = 'imc_conduit_1_25';
UPDATE base_materials SET id = 'imc112_ft' WHERE id = 'imc_conduit_1_5';
UPDATE base_materials SET id = 'imc2_ft' WHERE id = 'imc_conduit_2';
UPDATE base_materials SET id = 'imc212_ft' WHERE id = 'imc_conduit_2_5';
UPDATE base_materials SET id = 'imc3_ft' WHERE id = 'imc_conduit_3';
UPDATE base_materials SET id = 'imc4_ft' WHERE id = 'imc_conduit_4';

-- ==== 45° ELBOWS ====
UPDATE base_materials SET id = 'imc12_45' WHERE id = 'imc_45_0_5';
UPDATE base_materials SET id = 'imc34_45' WHERE id = 'imc_45_0_75';
UPDATE base_materials SET id = 'imc1_45' WHERE id = 'imc_45_1';
UPDATE base_materials SET id = 'imc114_45' WHERE id = 'imc_45_1_25';
UPDATE base_materials SET id = 'imc112_45' WHERE id = 'imc_45_1_5';
UPDATE base_materials SET id = 'imc2_45' WHERE id = 'imc_45_2';
UPDATE base_materials SET id = 'imc212_45' WHERE id = 'imc_45_2_5';
UPDATE base_materials SET id = 'imc3_45' WHERE id = 'imc_45_3';
UPDATE base_materials SET id = 'imc4_45' WHERE id = 'imc_45_4';

-- ==== 90° ELBOWS ====
UPDATE base_materials SET id = 'imc12_90' WHERE id = 'imc_90_0_5';
UPDATE base_materials SET id = 'imc34_90' WHERE id = 'imc_90_0_75';
UPDATE base_materials SET id = 'imc1_90' WHERE id = 'imc_90_1';
UPDATE base_materials SET id = 'imc114_90' WHERE id = 'imc_90_1_25';
UPDATE base_materials SET id = 'imc112_90' WHERE id = 'imc_90_1_5';
UPDATE base_materials SET id = 'imc2_90' WHERE id = 'imc_90_2';
UPDATE base_materials SET id = 'imc212_90' WHERE id = 'imc_90_2_5';
UPDATE base_materials SET id = 'imc3_90' WHERE id = 'imc_90_3';
UPDATE base_materials SET id = 'imc4_90' WHERE id = 'imc_90_4';

-- ==== CONNECTORS ====
UPDATE base_materials SET id = 'imc12_conn' WHERE id = 'imc_connector_0_5';
UPDATE base_materials SET id = 'imc34_conn' WHERE id = 'imc_connector_0_75';
UPDATE base_materials SET id = 'imc1_conn' WHERE id = 'imc_connector_1';
UPDATE base_materials SET id = 'imc114_conn' WHERE id = 'imc_connector_1_25';
UPDATE base_materials SET id = 'imc112_conn' WHERE id = 'imc_connector_1_5';
UPDATE base_materials SET id = 'imc2_conn' WHERE id = 'imc_connector_2';
UPDATE base_materials SET id = 'imc212_conn' WHERE id = 'imc_connector_2_5';
UPDATE base_materials SET id = 'imc3_conn' WHERE id = 'imc_connector_3';
UPDATE base_materials SET id = 'imc4_conn' WHERE id = 'imc_connector_4';

-- ==== COUPLINGS ====
UPDATE base_materials SET id = 'imc12_cpl' WHERE id = 'imc_coupling_0_5';
UPDATE base_materials SET id = 'imc34_cpl' WHERE id = 'imc_coupling_0_75';
UPDATE base_materials SET id = 'imc1_cpl' WHERE id = 'imc_coupling_1';
UPDATE base_materials SET id = 'imc114_cpl' WHERE id = 'imc_coupling_1_25';
UPDATE base_materials SET id = 'imc112_cpl' WHERE id = 'imc_coupling_1_5';
UPDATE base_materials SET id = 'imc2_cpl' WHERE id = 'imc_coupling_2';
UPDATE base_materials SET id = 'imc212_cpl' WHERE id = 'imc_coupling_2_5';
UPDATE base_materials SET id = 'imc3_cpl' WHERE id = 'imc_coupling_3';
UPDATE base_materials SET id = 'imc4_cpl' WHERE id = 'imc_coupling_4';

-- ==== LB BODIES ====
UPDATE base_materials SET id = 'imc12_lb' WHERE id = 'imc_lb_0_5';
UPDATE base_materials SET id = 'imc34_lb' WHERE id = 'imc_lb_0_75';
UPDATE base_materials SET id = 'imc1_lb' WHERE id = 'imc_lb_1';
UPDATE base_materials SET id = 'imc114_lb' WHERE id = 'imc_lb_1_25';
UPDATE base_materials SET id = 'imc112_lb' WHERE id = 'imc_lb_1_5';
UPDATE base_materials SET id = 'imc2_lb' WHERE id = 'imc_lb_2';
UPDATE base_materials SET id = 'imc3_lb' WHERE id = 'imc_lb_3';
UPDATE base_materials SET id = 'imc4_lb' WHERE id = 'imc_lb_4';
UPDATE base_materials SET id = 'imc5_lb' WHERE id = 'imc_lb_5';

-- ==== LL BODIES ====
UPDATE base_materials SET id = 'imc12_ll' WHERE id = 'imc_ll_0_5';
UPDATE base_materials SET id = 'imc34_ll' WHERE id = 'imc_ll_0_75';
UPDATE base_materials SET id = 'imc1_ll' WHERE id = 'imc_ll_1';
UPDATE base_materials SET id = 'imc114_ll' WHERE id = 'imc_ll_1_25';
UPDATE base_materials SET id = 'imc112_ll' WHERE id = 'imc_ll_1_5';
UPDATE base_materials SET id = 'imc2_ll' WHERE id = 'imc_ll_2';
UPDATE base_materials SET id = 'imc3_ll' WHERE id = 'imc_ll_3';
UPDATE base_materials SET id = 'imc4_ll' WHERE id = 'imc_ll_4';
UPDATE base_materials SET id = 'imc5_ll' WHERE id = 'imc_ll_5';

-- ==== LR BODIES ====
UPDATE base_materials SET id = 'imc12_lr' WHERE id = 'imc_lr_0_5';
UPDATE base_materials SET id = 'imc34_lr' WHERE id = 'imc_lr_0_75';
UPDATE base_materials SET id = 'imc1_lr' WHERE id = 'imc_lr_1';
UPDATE base_materials SET id = 'imc114_lr' WHERE id = 'imc_lr_1_25';
UPDATE base_materials SET id = 'imc112_lr' WHERE id = 'imc_lr_1_5';
UPDATE base_materials SET id = 'imc2_lr' WHERE id = 'imc_lr_2';
UPDATE base_materials SET id = 'imc3_lr' WHERE id = 'imc_lr_3';
UPDATE base_materials SET id = 'imc4_lr' WHERE id = 'imc_lr_4';
UPDATE base_materials SET id = 'imc5_lr' WHERE id = 'imc_lr_5';

-- ==== UNISTRUT STRAPS ====
UPDATE base_materials SET id = 'imc12_strap_uni' WHERE id = 'imc_unistrut_0_5';
UPDATE base_materials SET id = 'imc34_strap_uni' WHERE id = 'imc_unistrut_0_75';
UPDATE base_materials SET id = 'imc1_strap_uni' WHERE id = 'imc_unistrut_1';
UPDATE base_materials SET id = 'imc114_strap_uni' WHERE id = 'imc_unistrut_1_25';
UPDATE base_materials SET id = 'imc112_strap_uni' WHERE id = 'imc_unistrut_1_5';
UPDATE base_materials SET id = 'imc2_strap_uni' WHERE id = 'imc_unistrut_2';
UPDATE base_materials SET id = 'imc212_strap_uni' WHERE id = 'imc_unistrut_2_5';
UPDATE base_materials SET id = 'imc3_strap_uni' WHERE id = 'imc_unistrut_3';
UPDATE base_materials SET id = 'imc4_strap_uni' WHERE id = 'imc_unistrut_4';

-- ==== 1-HOLE STRAPS ====
UPDATE base_materials SET id = 'imc12_strap_1h' WHERE id = 'imc_strap1_0_5';
UPDATE base_materials SET id = 'imc34_strap_1h' WHERE id = 'imc_strap1_0_75';
UPDATE base_materials SET id = 'imc1_strap_1h' WHERE id = 'imc_strap1_1';
UPDATE base_materials SET id = 'imc114_strap_1h' WHERE id = 'imc_strap1_1_25';
UPDATE base_materials SET id = 'imc112_strap_1h' WHERE id = 'imc_strap1_1_5';
UPDATE base_materials SET id = 'imc2_strap_1h' WHERE id = 'imc_strap1_2';
UPDATE base_materials SET id = 'imc212_strap_1h' WHERE id = 'imc_strap1_2_5';
UPDATE base_materials SET id = 'imc3_strap_1h' WHERE id = 'imc_strap1_3';
UPDATE base_materials SET id = 'imc4_strap_1h' WHERE id = 'imc_strap1_4';

-- ==== 2-HOLE STRAPS ====
UPDATE base_materials SET id = 'imc12_strap_2h' WHERE id = 'imc_strap2_0_5';
UPDATE base_materials SET id = 'imc34_strap_2h' WHERE id = 'imc_strap2_0_75';
UPDATE base_materials SET id = 'imc1_strap_2h' WHERE id = 'imc_strap2_1';
UPDATE base_materials SET id = 'imc114_strap_2h' WHERE id = 'imc_strap2_1_25';
UPDATE base_materials SET id = 'imc112_strap_2h' WHERE id = 'imc_strap2_1_5';
UPDATE base_materials SET id = 'imc2_strap_2h' WHERE id = 'imc_strap2_2';
UPDATE base_materials SET id = 'imc212_strap_2h' WHERE id = 'imc_strap2_2_5';
UPDATE base_materials SET id = 'imc3_strap_2h' WHERE id = 'imc_strap2_3';
UPDATE base_materials SET id = 'imc4_strap_2h' WHERE id = 'imc_strap2_4';

-- ==== STANDOFF STRAPS ====
UPDATE base_materials SET id = 'imc12_standoff' WHERE id = 'imc_standoff_0_5';
UPDATE base_materials SET id = 'imc34_standoff' WHERE id = 'imc_standoff_0_75';
UPDATE base_materials SET id = 'imc1_standoff' WHERE id = 'imc_standoff_1';
UPDATE base_materials SET id = 'imc114_standoff' WHERE id = 'imc_standoff_1_25';
UPDATE base_materials SET id = 'imc112_standoff' WHERE id = 'imc_standoff_1_5';
UPDATE base_materials SET id = 'imc2_standoff' WHERE id = 'imc_standoff_2';
UPDATE base_materials SET id = 'imc212_standoff' WHERE id = 'imc_standoff_2_5';
UPDATE base_materials SET id = 'imc3_standoff' WHERE id = 'imc_standoff_3';
UPDATE base_materials SET id = 'imc4_standoff' WHERE id = 'imc_standoff_4';
UPDATE base_materials SET id = 'imc5_standoff' WHERE id = 'imc_standoff_5';

-- ==== CLOSE NIPPLES ====
UPDATE base_materials SET id = 'imc12_nip_close' WHERE id = 'imc_nipple_close_0_5';
UPDATE base_materials SET id = 'imc34_nip_close' WHERE id = 'imc_nipple_close_0_75';
UPDATE base_materials SET id = 'imc1_nip_close' WHERE id = 'imc_nipple_close_1';
UPDATE base_materials SET id = 'imc114_nip_close' WHERE id = 'imc_nipple_close_1_25';
UPDATE base_materials SET id = 'imc112_nip_close' WHERE id = 'imc_nipple_close_1_5';
UPDATE base_materials SET id = 'imc2_nip_close' WHERE id = 'imc_nipple_close_2';
UPDATE base_materials SET id = 'imc3_nip_close' WHERE id = 'imc_nipple_close_3';
UPDATE base_materials SET id = 'imc4_nip_close' WHERE id = 'imc_nipple_close_4';
UPDATE base_materials SET id = 'imc5_nip_close' WHERE id = 'imc_nipple_close_5';

-- ==== 6" NIPPLES ====
UPDATE base_materials SET id = 'imc12_nip_6in' WHERE id = 'imc_nipple_6_0_5';
UPDATE base_materials SET id = 'imc34_nip_6in' WHERE id = 'imc_nipple_6_0_75';
UPDATE base_materials SET id = 'imc1_nip_6in' WHERE id = 'imc_nipple_6_1';
UPDATE base_materials SET id = 'imc114_nip_6in' WHERE id = 'imc_nipple_6_1_25';
UPDATE base_materials SET id = 'imc112_nip_6in' WHERE id = 'imc_nipple_6_1_5';
UPDATE base_materials SET id = 'imc2_nip_6in' WHERE id = 'imc_nipple_6_2';
UPDATE base_materials SET id = 'imc3_nip_6in' WHERE id = 'imc_nipple_6_3';
UPDATE base_materials SET id = 'imc4_nip_6in' WHERE id = 'imc_nipple_6_4';
UPDATE base_materials SET id = 'imc5_nip_6in' WHERE id = 'imc_nipple_6_5';

-- ==== 12" NIPPLES ====
UPDATE base_materials SET id = 'imc12_nip_12in' WHERE id = 'imc_nipple_12_0_5';
UPDATE base_materials SET id = 'imc34_nip_12in' WHERE id = 'imc_nipple_12_0_75';
UPDATE base_materials SET id = 'imc1_nip_12in' WHERE id = 'imc_nipple_12_1';
UPDATE base_materials SET id = 'imc114_nip_12in' WHERE id = 'imc_nipple_12_1_25';
UPDATE base_materials SET id = 'imc112_nip_12in' WHERE id = 'imc_nipple_12_1_5';
UPDATE base_materials SET id = 'imc2_nip_12in' WHERE id = 'imc_nipple_12_2';
UPDATE base_materials SET id = 'imc3_nip_12in' WHERE id = 'imc_nipple_12_3';
UPDATE base_materials SET id = 'imc4_nip_12in' WHERE id = 'imc_nipple_12_4';
UPDATE base_materials SET id = 'imc5_nip_12in' WHERE id = 'imc_nipple_12_5';

-- ==== 18" NIPPLES ====
UPDATE base_materials SET id = 'imc12_nip_18in' WHERE id = 'imc_nipple_18_0_5';
UPDATE base_materials SET id = 'imc34_nip_18in' WHERE id = 'imc_nipple_18_0_75';
UPDATE base_materials SET id = 'imc1_nip_18in' WHERE id = 'imc_nipple_18_1';
UPDATE base_materials SET id = 'imc114_nip_18in' WHERE id = 'imc_nipple_18_1_25';
UPDATE base_materials SET id = 'imc112_nip_18in' WHERE id = 'imc_nipple_18_1_5';
UPDATE base_materials SET id = 'imc2_nip_18in' WHERE id = 'imc_nipple_18_2';
UPDATE base_materials SET id = 'imc3_nip_18in' WHERE id = 'imc_nipple_18_3';
UPDATE base_materials SET id = 'imc4_nip_18in' WHERE id = 'imc_nipple_18_4';
UPDATE base_materials SET id = 'imc5_nip_18in' WHERE id = 'imc_nipple_18_5';

-- ==== 24" NIPPLES ====
UPDATE base_materials SET id = 'imc12_nip_24in' WHERE id = 'imc_nipple_24_0_5';
UPDATE base_materials SET id = 'imc34_nip_24in' WHERE id = 'imc_nipple_24_0_75';
UPDATE base_materials SET id = 'imc1_nip_24in' WHERE id = 'imc_nipple_24_1';
UPDATE base_materials SET id = 'imc114_nip_24in' WHERE id = 'imc_nipple_24_1_25';
UPDATE base_materials SET id = 'imc112_nip_24in' WHERE id = 'imc_nipple_24_1_5';
UPDATE base_materials SET id = 'imc2_nip_24in' WHERE id = 'imc_nipple_24_2';
UPDATE base_materials SET id = 'imc3_nip_24in' WHERE id = 'imc_nipple_24_3';
UPDATE base_materials SET id = 'imc4_nip_24in' WHERE id = 'imc_nipple_24_4';
UPDATE base_materials SET id = 'imc5_nip_24in' WHERE id = 'imc_nipple_24_5';

COMMIT;

-- ================================================================
-- VERIFICATION
-- ================================================================

-- Summary by type
SELECT 
  'IMC Migration Summary' as report,
  COUNT(*) FILTER (WHERE id LIKE 'imc%_' AND id NOT LIKE 'imc%_ft' AND id NOT LIKE 'imc%_%') as base_conduit_10ft,
  COUNT(*) FILTER (WHERE id LIKE 'imc%_ft') as conduit_per_foot,
  COUNT(*) FILTER (WHERE id LIKE '%_45') as elbows_45,
  COUNT(*) FILTER (WHERE id LIKE '%_90') as elbows_90,
  COUNT(*) FILTER (WHERE id LIKE '%_conn') as connectors,
  COUNT(*) FILTER (WHERE id LIKE '%_cpl' AND id NOT LIKE '%_cpl_%') as couplings,
  COUNT(*) FILTER (WHERE id LIKE '%_strap_uni') as straps_unistrut,
  COUNT(*) FILTER (WHERE id LIKE '%_strap_1h') as straps_1hole,
  COUNT(*) FILTER (WHERE id LIKE '%_strap_2h') as straps_2hole,
  COUNT(*) FILTER (WHERE id LIKE '%_standoff') as standoffs,
  COUNT(*) FILTER (WHERE id LIKE '%_lb' OR id LIKE '%_ll' OR id LIKE '%_lr') as conduit_bodies,
  COUNT(*) FILTER (WHERE id LIKE '%_nip_%') as nipples
FROM base_materials
WHERE id LIKE 'imc%';

-- Sample of migrated materials
SELECT 
  'Sample Migrated IMC Materials' as info,
  id,
  name,
  basecost
FROM base_materials
WHERE id LIKE 'imc%'
ORDER BY id
LIMIT 25;

-- Check for old patterns
SELECT 
  'OLD PATTERNS (Should be empty)' as warning,
  COUNT(*) as count
FROM base_materials
WHERE id LIKE 'imc_%' OR id LIKE 'imc_conduit_%';

-- ================================================================
-- MIGRATION COMPLETE!
-- ================================================================
SELECT '✅ IMC Conduit Material ID Reorganization Complete!' as status,
       'Search "imc12_" to find ALL 1/2" IMC materials' as tip1,
       'Search "imc12_ft" for per-foot pricing' as tip2,
       'Search "_cpl" to find ALL couplings across all conduit types' as tip3;
