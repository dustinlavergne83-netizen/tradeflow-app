-- ========================================
-- FIX WRONG AUTO_ADD IDS FOR 1/2" EMT
-- ========================================
-- Problem: 1/2" EMT fittings are pointing to wrong size couplings/connectors
-- Solution: Update the auto_add_coupling_id and auto_add_connector_id to point to the correct size

-- Step 1: Find the correct material IDs
-- ========================================

-- ===== COUPLINGS =====

-- Find the CORRECT 1/2" EMT Compression Coupling
SELECT id, name, category, unit, basecost 
FROM base_materials 
WHERE name ILIKE '%1/2%compression%coupling%'
  AND name ILIKE '%emt%'
  AND name NOT ILIKE '%1-1/2%'
ORDER BY name;

-- Find the CORRECT 1/2" EMT Set Screw Coupling
SELECT id, name, category, unit, basecost 
FROM base_materials 
WHERE name ILIKE '%1/2%set%screw%coupling%'
  AND name ILIKE '%emt%'
  AND name NOT ILIKE '%1-1/2%'
ORDER BY name;

-- Find the WRONG 1-1/2" EMT Compression Coupling (currently being used incorrectly)
SELECT id, name, category, unit, basecost 
FROM base_materials 
WHERE name ILIKE '%1-1/2%compression%coupling%'
  AND name ILIKE '%emt%'
ORDER BY name;

-- Find the WRONG 1-1/2" EMT Set Screw Coupling (if being used incorrectly)
SELECT id, name, category, unit, basecost 
FROM base_materials 
WHERE name ILIKE '%1-1/2%set%screw%coupling%'
  AND name ILIKE '%emt%'
ORDER BY name;

-- ===== CONNECTORS =====

-- Find the CORRECT 1/2" EMT Compression Connector
SELECT id, name, category, unit, basecost 
FROM base_materials 
WHERE name ILIKE '%1/2%compression%connector%'
  AND name ILIKE '%emt%'
  AND name NOT ILIKE '%1-1/2%'
ORDER BY name;

-- Find the CORRECT 1/2" EMT Set Screw Connector
SELECT id, name, category, unit, basecost 
FROM base_materials 
WHERE name ILIKE '%1/2%set%screw%connector%'
  AND name ILIKE '%emt%'
  AND name NOT ILIKE '%1-1/2%'
ORDER BY name;

-- Find the WRONG 1-1/2" EMT Compression Connector (if being used incorrectly)
SELECT id, name, category, unit, basecost 
FROM base_materials 
WHERE name ILIKE '%1-1/2%compression%connector%'
  AND name ILIKE '%emt%'
ORDER BY name;

-- Find the WRONG 1-1/2" EMT Set Screw Connector (if being used incorrectly)
SELECT id, name, category, unit, basecost 
FROM base_materials 
WHERE name ILIKE '%1-1/2%set%screw%connector%'
  AND name ILIKE '%emt%'
ORDER BY name;

-- Find all 1/2" EMT fittings (90s, 45s, LBs, etc.)
SELECT id, name, category, auto_add_coupling_id, auto_add_connector_id
FROM base_materials 
WHERE name ILIKE '%1/2%emt%'
  AND name NOT ILIKE '%1-1/2%'
  AND (name ILIKE '%90%' OR name ILIKE '%45%' OR name ILIKE '%lb %' OR name ILIKE '%ll %' OR name ILIKE '%lr %' OR name ILIKE '%body%')
ORDER BY name;

-- Step 2: UPDATE statements to fix the wrong IDs
-- ========================================
-- IMPORTANT: Replace the placeholder IDs with the actual IDs from Step 1

-- ===== FIX COUPLINGS =====

-- Fix COMPRESSION type fittings (90s, 45s)
-- UPDATE base_materials 
-- SET auto_add_coupling_id = 'CORRECT_1/2_COMPRESSION_COUPLING_ID'
-- WHERE name ILIKE '%1/2%emt%'
--   AND name NOT ILIKE '%1-1/2%'
--   AND name ILIKE '%compression%'
--   AND (name ILIKE '%90%' OR name ILIKE '%45%' OR name ILIKE '%elbow%')
--   AND auto_add_coupling_id IS NOT NULL;

-- Fix SET SCREW type fittings (90s, 45s)
-- UPDATE base_materials 
-- SET auto_add_coupling_id = 'CORRECT_1/2_SET_SCREW_COUPLING_ID'
-- WHERE name ILIKE '%1/2%emt%'
--   AND name NOT ILIKE '%1-1/2%'
--   AND name ILIKE '%set%screw%'
--   AND (name ILIKE '%90%' OR name ILIKE '%45%' OR name ILIKE '%elbow%')
--   AND auto_add_coupling_id IS NOT NULL;

-- ===== FIX CONNECTORS =====

-- Fix COMPRESSION type bodies (LB, LL, LR)
-- UPDATE base_materials 
-- SET auto_add_connector_id = 'CORRECT_1/2_COMPRESSION_CONNECTOR_ID'
-- WHERE name ILIKE '%1/2%emt%'
--   AND name NOT ILIKE '%1-1/2%'
--   AND name ILIKE '%compression%'
--   AND (name ILIKE '%lb %' OR name ILIKE '%ll %' OR name ILIKE '%lr %' OR name ILIKE '%body%')
--   AND auto_add_connector_id IS NOT NULL;

-- Fix SET SCREW type bodies (LB, LL, LR)
-- UPDATE base_materials 
-- SET auto_add_connector_id = 'CORRECT_1/2_SET_SCREW_CONNECTOR_ID'
-- WHERE name ILIKE '%1/2%emt%'
--   AND name NOT ILIKE '%1-1/2%'
--   AND name ILIKE '%set%screw%'
--   AND (name ILIKE '%lb %' OR name ILIKE '%ll %' OR name ILIKE '%lr %' OR name ILIKE '%body%')
--   AND auto_add_connector_id IS NOT NULL;

-- Step 3: Verify the fix
-- ========================================

-- ===== VERIFY COUPLINGS =====
-- Check all 1/2" EMT fittings and their coupling IDs
SELECT 
  fm.id AS fitting_id,
  fm.name AS fitting_name,
  fm.auto_add_coupling_id,
  cm.name AS coupling_name,
  CASE 
    WHEN fm.name ILIKE '%compression%' AND cm.name ILIKE '%compression%' THEN '✓ MATCH'
    WHEN fm.name ILIKE '%set%screw%' AND cm.name ILIKE '%set%screw%' THEN '✓ MATCH'
    WHEN cm.name IS NULL THEN '⚠ NO COUPLING'
    ELSE '✗ MISMATCH'
  END AS status
FROM base_materials fm
LEFT JOIN base_materials cm ON fm.auto_add_coupling_id = cm.id
WHERE fm.name ILIKE '%1/2%emt%'
  AND fm.name NOT ILIKE '%1-1/2%'
  AND (fm.name ILIKE '%90%' OR fm.name ILIKE '%45%' OR fm.name ILIKE '%elbow%')
ORDER BY fm.name;

-- ===== VERIFY CONNECTORS =====
-- Check all 1/2" EMT bodies and their connector IDs
SELECT 
  fm.id AS fitting_id,
  fm.name AS fitting_name,
  fm.auto_add_connector_id,
  cn.name AS connector_name,
  CASE 
    WHEN fm.name ILIKE '%compression%' AND cn.name ILIKE '%compression%' THEN '✓ MATCH'
    WHEN fm.name ILIKE '%set%screw%' AND cn.name ILIKE '%set%screw%' THEN '✓ MATCH'
    WHEN cn.name IS NULL THEN '⚠ NO CONNECTOR'
    ELSE '✗ MISMATCH'
  END AS status
FROM base_materials fm
LEFT JOIN base_materials cn ON fm.auto_add_connector_id = cn.id
WHERE fm.name ILIKE '%1/2%emt%'
  AND fm.name NOT ILIKE '%1-1/2%'
  AND (fm.name ILIKE '%lb %' OR fm.name ILIKE '%ll %' OR fm.name ILIKE '%lr %' OR fm.name ILIKE '%body%')
ORDER BY fm.name;

-- ========================================
-- INSTRUCTIONS:
-- ========================================
-- 1. Run the SELECT queries in Step 1 to find the correct material IDs
--    - Note BOTH compression AND set screw IDs for couplings
--    - Note BOTH compression AND set screw IDs for connectors
-- 2. Update the UPDATE statements in Step 2 with the correct IDs
--    - Replace 'CORRECT_1/2_COMPRESSION_COUPLING_ID' with actual ID
--    - Replace 'CORRECT_1/2_SET_SCREW_COUPLING_ID' with actual ID
--    - Replace 'CORRECT_1/2_COMPRESSION_CONNECTOR_ID' with actual ID
--    - Replace 'CORRECT_1/2_SET_SCREW_CONNECTOR_ID' with actual ID
-- 3. Uncomment and run each UPDATE statement
-- 4. Run the verification queries in Step 3 to confirm the fix
--    - Look for "✓ MATCH" status (compression fittings → compression couplings/connectors)
--    - Look for "✓ MATCH" status (set screw fittings → set screw couplings/connectors)
--    - Fix any "✗ MISMATCH" or "⚠ NO COUPLING/CONNECTOR" entries
-- ========================================
