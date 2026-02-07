-- ========================================
-- FIX: Remove Wrong Size Links
-- ========================================
-- Problem: 2-1/2" fittings got linked to 1/2" couplings/connectors
-- Solution: Clear those wrong links
-- ========================================

-- STEP 1: Remove wrong links from 2-1/2" fittings
-- ========================================
UPDATE base_materials 
SET auto_add_coupling_id = NULL,
    auto_add_connector_id = NULL
WHERE name ILIKE '%2-1/2" emt%'
  AND (name ILIKE '%90%' OR name ILIKE '%45%' OR name ILIKE '%body%');

-- STEP 2: Remove wrong links from any other wrong sizes
-- ========================================
-- Clear ALL links first, then we'll re-link ONLY 1/2" correctly
UPDATE base_materials 
SET auto_add_coupling_id = NULL,
    auto_add_connector_id = NULL
WHERE name ILIKE '%emt%'
  AND (name ILIKE '%90%' OR name ILIKE '%45%' OR name ILIKE '%body%')
  AND name NOT ILIKE '1/2" emt%';  -- Only keep links for EXACTLY "1/2" EMT"

-- STEP 3: Now re-link ONLY 1/2" fittings (use your coupling/connector IDs)
-- ========================================
-- Replace 'YOUR_COUPLING_ID' and 'YOUR_CONNECTOR_ID' with the SAME IDs you used before

-- Link 1/2" 90° and 45° fittings to coupling
UPDATE base_materials 
SET auto_add_coupling_id = 'YOUR_COUPLING_ID_HERE'
WHERE name ILIKE '1/2" emt%'  -- Starts with "1/2" EMT" (no wildcards before!)
  AND (name ILIKE '%90%' OR name ILIKE '%45%');

-- Link 1/2" bodies to connector
UPDATE base_materials 
SET auto_add_connector_id = 'YOUR_CONNECTOR_ID_HERE'
WHERE name ILIKE '1/2" emt%'  -- Starts with "1/2" EMT" (no wildcards before!)
  AND (name ILIKE '%body%' OR name ILIKE '%lb%' OR name ILIKE '%ll%' OR name ILIKE '%lr%');

-- STEP 4: Verify - should ONLY show 1/2" fittings now
-- ========================================
SELECT 
  f.name AS fitting,
  COALESCE(c.name, cn.name, 'NOT LINKED') AS will_auto_add,
  CASE 
    WHEN c.name IS NOT NULL OR cn.name IS NOT NULL THEN '✓ LINKED'
    ELSE '✗ NOT LINKED'
  END AS status
FROM base_materials f
LEFT JOIN base_materials c ON f.auto_add_coupling_id = c.id
LEFT JOIN base_materials cn ON f.auto_add_connector_id = cn.id
WHERE f.name ILIKE '%emt%'
  AND (f.name ILIKE '%90%' OR f.name ILIKE '%45%' OR f.name ILIKE '%body%')
  AND (c.name IS NOT NULL OR cn.name IS NOT NULL)
ORDER BY f.name;

-- ========================================
-- KEY FIX:
-- Changed from: name ILIKE '%1/2" emt%'  ❌ Matches 2-1/2"
-- Changed to:   name ILIKE '1/2" emt%'   ✅ Only matches "1/2" EMT"
-- (No % before 1/2" ensures it starts with that size)
-- ========================================
