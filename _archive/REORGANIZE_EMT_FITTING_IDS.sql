-- ================================================================
-- REORGANIZE EMT FITTING IDs FOR BETTER SEARCHABILITY
-- ================================================================
-- OLD PATTERN: emt12_ssconn, emt12_cpconn, emt12_sscpl, emt12_cpcpl
-- NEW PATTERN: emt12_conn_ss, emt12_conn_comp, emt12_cpl_ss, emt12_cpl_comp
-- ================================================================
-- Benefits of new pattern:
--   - Search "emt12_conn" to find ALL connectors
--   - Search "emt12_cpl" to find ALL couplings
--   - Search "_ss" to find ALL set-screw fittings
--   - Search "_comp" to find ALL compression fittings
-- ================================================================

-- ================================================================
-- STEP 1: CHECK what will be migrated
-- ================================================================
SELECT 
  'EMT Fittings to be Reorganized' as status,
  id as current_id,
  name,
  CASE
    -- Connectors
    WHEN id LIKE '%_ssconn' THEN REPLACE(id, '_ssconn', '_conn_ss')
    WHEN id LIKE '%_cpconn' THEN REPLACE(id, '_cpconn', '_conn_comp')
    -- Couplings
    WHEN id LIKE '%_sscpl' THEN REPLACE(id, '_sscpl', '_cpl_ss')
    WHEN id LIKE '%_cpcpl' THEN REPLACE(id, '_cpcpl', '_cpl_comp')
    ELSE id
  END as new_id
FROM base_materials
WHERE id LIKE 'emt%'
  AND (id LIKE '%_ssconn' OR id LIKE '%_cpconn' OR id LIKE '%_sscpl' OR id LIKE '%_cpcpl')
ORDER BY id;

-- ================================================================
-- STEP 2: MIGRATION - Reorganize all EMT fitting IDs
-- ================================================================

BEGIN;

-- Update Set-Screw Connectors: _ssconn → _conn_ss
UPDATE base_materials 
SET id = REPLACE(id, '_ssconn', '_conn_ss')
WHERE id LIKE 'emt%_ssconn';

-- Update Compression Connectors: _cpconn → _conn_comp
UPDATE base_materials 
SET id = REPLACE(id, '_cpconn', '_conn_comp')
WHERE id LIKE 'emt%_cpconn';

-- Update Set-Screw Couplings: _sscpl → _cpl_ss
UPDATE base_materials 
SET id = REPLACE(id, '_sscpl', '_cpl_ss')
WHERE id LIKE 'emt%_sscpl';

-- Update Compression Couplings: _cpcpl → _cpl_comp
UPDATE base_materials 
SET id = REPLACE(id, '_cpcpl', '_cpl_comp')
WHERE id LIKE 'emt%_cpcpl';

COMMIT;

-- ================================================================
-- STEP 3: VERIFY the migration
-- ================================================================

-- Show all reorganized connectors
SELECT 
  'EMT Connectors (After Reorganization)' as category,
  id,
  name,
  basecost,
  laborhours
FROM base_materials
WHERE id LIKE 'emt%_conn_%'
ORDER BY id;

-- Show all reorganized couplings
SELECT 
  'EMT Couplings (After Reorganization)' as category,
  id,
  name,
  basecost,
  laborhours
FROM base_materials
WHERE id LIKE 'emt%_cpl_%'
ORDER BY id;

-- Count by type
SELECT 
  'Summary' as info,
  COUNT(*) FILTER (WHERE id LIKE '%_conn_ss') as set_screw_connectors,
  COUNT(*) FILTER (WHERE id LIKE '%_conn_comp') as compression_connectors,
  COUNT(*) FILTER (WHERE id LIKE '%_cpl_ss') as set_screw_couplings,
  COUNT(*) FILTER (WHERE id LIKE '%_cpl_comp') as compression_couplings,
  COUNT(*) FILTER (WHERE id LIKE '%_conn_%') as total_connectors,
  COUNT(*) FILTER (WHERE id LIKE '%_cpl_%' AND id NOT LIKE '%_flexcpl%') as total_couplings
FROM base_materials
WHERE id LIKE 'emt%';

-- ================================================================
-- STEP 4: Check for any old pattern stragglers
-- ================================================================
SELECT 
  'OLD PATTERN STILL EXISTS (Should be empty)' as warning,
  id,
  name
FROM base_materials
WHERE id LIKE 'emt%'
  AND (id LIKE '%_ssconn' OR id LIKE '%_cpconn' OR id LIKE '%_sscpl' OR id LIKE '%_cpcpl')
ORDER BY id;
