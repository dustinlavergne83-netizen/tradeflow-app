-- ========================================
-- SIMPLE SOLUTION: Link ALL 1/2" EMT Fittings to One Default Type
-- ========================================
-- Since your fittings don't have "compression" or "set-screw" in their names,
-- we'll link them ALL to one default type (you choose: compression OR set-screw)
-- Then users can override this choice when building assemblies
-- ========================================

-- STEP 1: Get the coupling and connector IDs for your preferred default type
-- ========================================
-- Run these to see your options:
SELECT id, name FROM base_materials 
WHERE name ILIKE '%1/2" emt%coupling%' 
  AND name NOT ILIKE '%1-1/2%';

SELECT id, name FROM base_materials 
WHERE name ILIKE '%1/2" emt%connector%' 
  AND name NOT ILIKE '%1-1/2%';

-- STEP 2: Link ALL 90° and 45° fittings to ONE coupling (your choice)
-- ========================================
-- Replace 'YOUR_COUPLING_ID_HERE' with the coupling ID from Step 1
UPDATE base_materials 
SET auto_add_coupling_id = 'YOUR_COUPLING_ID_HERE'
WHERE name ILIKE '%1/2" emt%'
  AND name NOT ILIKE '%1-1/2%'
  AND (name ILIKE '%90%' OR name ILIKE '%45%');

-- STEP 3: Link ALL LB/LL/LR bodies to ONE connector (your choice)
-- ========================================
-- Replace 'YOUR_CONNECTOR_ID_HERE' with the connector ID from Step 1
UPDATE base_materials 
SET auto_add_connector_id = 'YOUR_CONNECTOR_ID_HERE'
WHERE name ILIKE '%1/2" emt%'
  AND name NOT ILIKE '%1-1/2%'
  AND (name ILIKE '%body%' OR name ILIKE '%lb%' OR name ILIKE '%ll%' OR name ILIKE '%lr%');

-- STEP 4: Verify it worked
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
WHERE f.name ILIKE '%1/2" emt%'
  AND f.name NOT ILIKE '%1-1/2%'
  AND (f.name ILIKE '%90%' OR f.name ILIKE '%45%' OR f.name ILIKE '%body%')
ORDER BY f.name;

-- ========================================
-- EXPLANATION:
-- ========================================
-- Your fittings don't specify compression vs set-screw in their names.
-- This links them ALL to one default type.
-- 
-- When users build assemblies, they can:
-- 1. Use these defaults, OR
-- 2. Select different connectors/couplings from the dropdowns
-- 
-- The user's selection will OVERRIDE these defaults (see USER_SELECTED_IDS_SOLUTION.md)
-- ========================================
