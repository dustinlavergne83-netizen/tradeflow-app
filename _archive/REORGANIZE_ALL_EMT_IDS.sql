-- ================================================================
-- COMPLETE EMT MATERIAL ID REORGANIZATION
-- ================================================================
-- This script runs ALL EMT reorganizations at once
-- Run this single script to update all EMT material IDs at once
-- ================================================================

-- ================================================================
-- PART 1: REORGANIZE BASE CONDUIT
-- ================================================================
-- OLD: emt12, emt34, emt1, emt2, etc
-- NEW: emt12_, emt34_, emt1_, emt2_, etc (with trailing underscore)
-- ================================================================

-- Preview base conduit changes
SELECT 
  'BASE CONDUIT to be Reorganized' as migration_phase,
  id as current_id,
  name,
  CASE
    WHEN id = 'emt12' THEN 'emt12_'
    WHEN id = 'emt34' THEN 'emt34_'
    WHEN id = 'emt1' THEN 'emt1_'
    WHEN id = 'emt114' THEN 'emt114_'
    WHEN id = 'emt112' THEN 'emt112_'
    WHEN id = 'emt2' THEN 'emt2_'
    WHEN id = 'emt212' THEN 'emt212_'
    WHEN id = 'emt3' THEN 'emt3_'
    WHEN id = 'emt312' THEN 'emt312_'
    WHEN id = 'emt4' THEN 'emt4_'
    ELSE id
  END as new_id
FROM base_materials
WHERE id IN ('emt12', 'emt34', 'emt1', 'emt114', 'emt112', 'emt2', 'emt212', 'emt3', 'emt312', 'emt4')
ORDER BY id;

-- ================================================================
-- PART 2: REORGANIZE FITTINGS (Connectors & Couplings)
-- ================================================================
-- OLD: emt12_ssconn, emt12_cpconn, emt12_sscpl, emt12_cpcpl
-- NEW: emt12_conn_ss, emt12_conn_comp, emt12_cpl_ss, emt12_cpl_comp
-- ================================================================

-- Preview fitting changes
SELECT 
  'FITTINGS to be Reorganized' as migration_phase,
  id as current_id,
  name,
  CASE
    WHEN id LIKE '%_ssconn' THEN REPLACE(id, '_ssconn', '_conn_ss')
    WHEN id LIKE '%_cpconn' THEN REPLACE(id, '_cpconn', '_conn_comp')
    WHEN id LIKE '%_sscpl' THEN REPLACE(id, '_sscpl', '_cpl_ss')
    WHEN id LIKE '%_cpcpl' THEN REPLACE(id, '_cpcpl', '_cpl_comp')
    ELSE id
  END as new_id
FROM base_materials
WHERE id LIKE 'emt%'
  AND (id LIKE '%_ssconn' OR id LIKE '%_cpconn' OR id LIKE '%_sscpl' OR id LIKE '%_cpcpl')
ORDER BY id;

-- ================================================================
-- PART 3: REORGANIZE STRAPS
-- ================================================================
-- OLD: emt12_usclamp, emt12_1hole, emt12_2hole, emt12_strap
-- NEW: emt12_strap_uni, emt12_strap_1h, emt12_strap_2h, emt12_strap_std
-- ================================================================

-- Preview strap changes
SELECT 
  'STRAPS to be Reorganized' as migration_phase,
  id as current_id,
  name,
  CASE
    WHEN id LIKE '%_usclamp' THEN REPLACE(id, '_usclamp', '_strap_uni')
    WHEN id LIKE '%_1hole' THEN REPLACE(id, '_1hole', '_strap_1h')
    WHEN id LIKE '%_2hole' THEN REPLACE(id, '_2hole', '_strap_2h')
    WHEN id LIKE 'emt%_strap' AND id NOT LIKE '%_strap_%' THEN REPLACE(id, '_strap', '_strap_std')
    ELSE id
  END as new_id
FROM base_materials
WHERE id LIKE 'emt%'
  AND (id LIKE '%_usclamp' OR id LIKE '%_1hole' OR id LIKE '%_2hole' OR id LIKE '%_strap')
  AND id NOT LIKE '%_standoff'
  AND id NOT LIKE '%_strap_%'
ORDER BY id;

-- ================================================================
-- EXECUTE ALL MIGRATIONS
-- ================================================================

BEGIN;

-- BASE CONDUIT: Add trailing underscore
UPDATE base_materials SET id = 'emt12_' WHERE id = 'emt12';
UPDATE base_materials SET id = 'emt34_' WHERE id = 'emt34';
UPDATE base_materials SET id = 'emt1_' WHERE id = 'emt1';
UPDATE base_materials SET id = 'emt114_' WHERE id = 'emt114';
UPDATE base_materials SET id = 'emt112_' WHERE id = 'emt112';
UPDATE base_materials SET id = 'emt2_' WHERE id = 'emt2';
UPDATE base_materials SET id = 'emt212_' WHERE id = 'emt212';
UPDATE base_materials SET id = 'emt3_' WHERE id = 'emt3';
UPDATE base_materials SET id = 'emt312_' WHERE id = 'emt312';
UPDATE base_materials SET id = 'emt4_' WHERE id = 'emt4';

-- FITTINGS: Update Set-Screw Connectors
UPDATE base_materials 
SET id = REPLACE(id, '_ssconn', '_conn_ss')
WHERE id LIKE 'emt%_ssconn';

-- FITTINGS: Update Compression Connectors
UPDATE base_materials 
SET id = REPLACE(id, '_cpconn', '_conn_comp')
WHERE id LIKE 'emt%_cpconn';

-- FITTINGS: Update Set-Screw Couplings
UPDATE base_materials 
SET id = REPLACE(id, '_sscpl', '_cpl_ss')
WHERE id LIKE 'emt%_sscpl';

-- FITTINGS: Update Compression Couplings
UPDATE base_materials 
SET id = REPLACE(id, '_cpcpl', '_cpl_comp')
WHERE id LIKE 'emt%_cpcpl';

-- STRAPS: Update Unistrut Straps
UPDATE base_materials 
SET id = REPLACE(id, '_usclamp', '_strap_uni')
WHERE id LIKE 'emt%_usclamp';

-- STRAPS: Update 1-Hole Straps
UPDATE base_materials 
SET id = REPLACE(id, '_1hole', '_strap_1h')
WHERE id LIKE 'emt%_1hole';

-- STRAPS: Update 2-Hole Straps
UPDATE base_materials 
SET id = REPLACE(id, '_2hole', '_strap_2h')
WHERE id LIKE 'emt%_2hole';

-- STRAPS: Update Standard Straps
UPDATE base_materials 
SET id = REPLACE(id, '_strap', '_strap_std')
WHERE id LIKE 'emt%_strap' 
  AND id NOT LIKE '%_strap_%'
  AND id NOT LIKE '%_standoff';

COMMIT;

-- ================================================================
-- VERIFICATION - Show all reorganized materials
-- ================================================================

-- Base Conduit
SELECT 
  'BASE CONDUIT (After Migration)' as category,
  id,
  name,
  basecost,
  laborhours
FROM base_materials
WHERE id IN ('emt12_', 'emt34_', 'emt1_', 'emt114_', 'emt112_', 'emt2_', 'emt212_', 'emt3_', 'emt312_', 'emt4_')
ORDER BY id;

-- Connectors
SELECT 
  'CONNECTORS (After Migration)' as category,
  id,
  name,
  basecost,
  laborhours
FROM base_materials
WHERE id LIKE 'emt%_conn_%'
ORDER BY id;

-- Couplings
SELECT 
  'COUPLINGS (After Migration)' as category,
  id,
  name,
  basecost,
  laborhours
FROM base_materials
WHERE id LIKE 'emt%_cpl_%'
ORDER BY id;

-- Straps
SELECT 
  'STRAPS (After Migration)' as category,
  id,
  name,
  basecost,
  laborhours
FROM base_materials
WHERE id LIKE 'emt%_strap_%'
ORDER BY id;

-- ================================================================
-- SUMMARY COUNTS
-- ================================================================
SELECT 
  'MIGRATION SUMMARY' as report,
  COUNT(*) FILTER (WHERE id LIKE '%_conn_ss') as set_screw_connectors,
  COUNT(*) FILTER (WHERE id LIKE '%_conn_comp') as compression_connectors,
  COUNT(*) FILTER (WHERE id LIKE '%_cpl_ss') as set_screw_couplings,
  COUNT(*) FILTER (WHERE id LIKE '%_cpl_comp') as compression_couplings,
  COUNT(*) FILTER (WHERE id LIKE '%_strap_uni') as unistrut_straps,
  COUNT(*) FILTER (WHERE id LIKE '%_strap_1h') as one_hole_straps,
  COUNT(*) FILTER (WHERE id LIKE '%_strap_2h') as two_hole_straps,
  COUNT(*) FILTER (WHERE id LIKE '%_strap_std') as standard_straps
FROM base_materials
WHERE id LIKE 'emt%';

-- ================================================================
-- CHECK FOR STRAGGLERS (Should all be empty)
-- ================================================================
SELECT 
  'OLD FITTING PATTERNS REMAINING (Should be empty)' as warning,
  id,
  name
FROM base_materials
WHERE id LIKE 'emt%'
  AND (id LIKE '%_ssconn' OR id LIKE '%_cpconn' OR id LIKE '%_sscpl' OR id LIKE '%_cpcpl')
ORDER BY id;

SELECT 
  'OLD STRAP PATTERNS REMAINING (Should be empty)' as warning,
  id,
  name
FROM base_materials
WHERE id LIKE 'emt%'
  AND (id LIKE '%_usclamp' OR id LIKE '%_1hole' OR id LIKE '%_2hole')
ORDER BY id;

-- ================================================================
-- MIGRATION COMPLETE
-- ================================================================
SELECT '✅ EMT Material ID Reorganization Complete!' as status;
