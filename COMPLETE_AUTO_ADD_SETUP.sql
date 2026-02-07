-- ========================================
-- COMPLETE AUTO-ADD SETUP (ONE SCRIPT)
-- ========================================
-- Run this entire script - it will:
-- 1. Show you all the materials you need
-- 2. Give you ready-to-run UPDATE statements
-- ========================================

-- STEP 1: Find all 1/2" EMT Couplings (copy the IDs)
-- ========================================
SELECT id, name, category 
FROM base_materials 
WHERE name ILIKE '%1/2" emt%coupling%'
  AND name NOT ILIKE '%1-1/2%'
ORDER BY name;
-- You should see TWO couplings: Compression and Set-Screw

-- STEP 2: Find all 1/2" EMT Connectors (copy the IDs)
-- ========================================
SELECT id, name, category 
FROM base_materials 
WHERE name ILIKE '%1/2" emt%connector%'
  AND name NOT ILIKE '%1-1/2%'
ORDER BY name;
-- You should see TWO connectors: Compression and Set-Screw

-- STEP 3: Ready-to-run UPDATE statements
-- ========================================
-- Replace 'PASTE_ID_HERE' with the actual material IDs from above

-- Link 90° and 45° fittings to their couplings
UPDATE base_materials 
SET auto_add_coupling_id = 'PASTE_COUPLING_ID_HERE'
WHERE name ILIKE '%1/2" emt%'
  AND name NOT ILIKE '%1-1/2%'
  AND (name ILIKE '%90%' OR name ILIKE '%45%');

-- Link LB/LL/LR bodies to their connectors (bodies need 2 connectors)
UPDATE base_materials 
SET auto_add_connector_id = 'PASTE_CONNECTOR_ID_HERE'
WHERE name ILIKE '%1/2" emt%'
  AND name NOT ILIKE '%1-1/2%'
  AND (name ILIKE '%lb%' OR name ILIKE '%ll%' OR name ILIKE '%lr%' OR name ILIKE '%body%');

-- STEP 4: Verify it worked
-- ========================================
SELECT 
  f.name AS fitting,
  c.name AS will_auto_add
FROM base_materials f
LEFT JOIN base_materials c ON f.auto_add_coupling_id = c.id OR f.auto_add_connector_id = c.id
WHERE f.name ILIKE '%1/2" emt%'
  AND f.name NOT ILIKE '%1-1/2%'
  AND (f.name ILIKE '%90%' OR f.name ILIKE '%45%' OR f.name ILIKE '%body%')
ORDER BY f.name;

-- ========================================
-- SIMPLE INSTRUCTIONS:
-- ========================================
-- 1. Look at STEP 1 results - copy ONE coupling ID
-- 2. Look at STEP 2 results - copy ONE connector ID  
-- 3. Paste those IDs into the UPDATE statements in STEP 3
-- 4. Run those UPDATE statements
-- 5. Run STEP 4 to verify it worked
-- ========================================
