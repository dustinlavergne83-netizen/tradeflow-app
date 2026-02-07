-- ========================================
-- LINK ALL EMT SIZES AT ONCE (Smart Script)
-- ========================================
-- This automatically links ALL sizes to their matching couplings/connectors
-- No need to do each size manually!
-- ========================================

-- STEP 1: Link ALL EMT 90° and 45° fittings to their size-matched couplings
-- ========================================
-- This finds the coupling that matches the fitting's size and type
UPDATE base_materials AS fitting
SET auto_add_coupling_id = (
  SELECT coupling.id 
  FROM base_materials AS coupling
  WHERE coupling.name ILIKE '%coupling%'
    -- Match the size (extract from fitting name and find in coupling name)
    AND (
      (fitting.name ILIKE '1/2" emt%' AND coupling.name ILIKE '1/2" emt%') OR
      (fitting.name ILIKE '3/4" emt%' AND coupling.name ILIKE '3/4" emt%') OR
      (fitting.name ILIKE '1" emt%' AND coupling.name ILIKE '1" emt%' AND coupling.name NOT ILIKE '1-1/%') OR
      (fitting.name ILIKE '1-1/4" emt%' AND coupling.name ILIKE '1-1/4" emt%') OR
      (fitting.name ILIKE '1-1/2" emt%' AND coupling.name ILIKE '1-1/2" emt%') OR
      (fitting.name ILIKE '2" emt%' AND coupling.name ILIKE '2" emt%' AND coupling.name NOT ILIKE '2-1/%') OR
      (fitting.name ILIKE '2-1/2" emt%' AND coupling.name ILIKE '2-1/2" emt%') OR
      (fitting.name ILIKE '3" emt%' AND coupling.name ILIKE '3" emt%' AND coupling.name NOT ILIKE '3-1/%') OR
      (fitting.name ILIKE '3-1/2" emt%' AND coupling.name ILIKE '3-1/2" emt%') OR
      (fitting.name ILIKE '4" emt%' AND coupling.name ILIKE '4" emt%')
    )
  LIMIT 1
)
WHERE fitting.name ILIKE '%emt%'
  AND (fitting.name ILIKE '%90%' OR fitting.name ILIKE '%45%')
  AND fitting.category = 'Fittings';

-- STEP 2: Link ALL EMT bodies to their size-matched connectors
-- ========================================
UPDATE base_materials AS fitting
SET auto_add_connector_id = (
  SELECT connector.id 
  FROM base_materials AS connector
  WHERE connector.name ILIKE '%connector%'
    -- Match the size
    AND (
      (fitting.name ILIKE '1/2" emt%' AND connector.name ILIKE '1/2" emt%') OR
      (fitting.name ILIKE '3/4" emt%' AND connector.name ILIKE '3/4" emt%') OR
      (fitting.name ILIKE '1" emt%' AND connector.name ILIKE '1" emt%' AND connector.name NOT ILIKE '1-1/%') OR
      (fitting.name ILIKE '1-1/4" emt%' AND connector.name ILIKE '1-1/4" emt%') OR
      (fitting.name ILIKE '1-1/2" emt%' AND connector.name ILIKE '1-1/2" emt%') OR
      (fitting.name ILIKE '2" emt%' AND connector.name ILIKE '2" emt%' AND connector.name NOT ILIKE '2-1/%') OR
      (fitting.name ILIKE '2-1/2" emt%' AND connector.name ILIKE '2-1/2" emt%') OR
      (fitting.name ILIKE '3" emt%' AND connector.name ILIKE '3" emt%' AND connector.name NOT ILIKE '3-1/%') OR
      (fitting.name ILIKE '3-1/2" emt%' AND connector.name ILIKE '3-1/2" emt%') OR
      (fitting.name ILIKE '4" emt%' AND connector.name ILIKE '4" emt%')
    )
  LIMIT 1
)
WHERE fitting.name ILIKE '%emt%'
  AND (fitting.name ILIKE '%body%' OR fitting.name ILIKE '%lb%' OR fitting.name ILIKE '%ll%' OR fitting.name ILIKE '%lr%')
  AND fitting.category = 'Fittings';

-- STEP 3: Verify ALL sizes are linked correctly
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
  AND f.category = 'Fittings'
ORDER BY 
  CASE 
    WHEN f.name ILIKE '1/2"%' THEN 1
    WHEN f.name ILIKE '3/4"%' THEN 2
    WHEN f.name ILIKE '1"%' AND f.name NOT ILIKE '1-1/%' THEN 3
    WHEN f.name ILIKE '1-1/4"%' THEN 4
    WHEN f.name ILIKE '1-1/2"%' THEN 5
    WHEN f.name ILIKE '2"%' AND f.name NOT ILIKE '2-1/%' THEN 6
    WHEN f.name ILIKE '2-1/2"%' THEN 7
    WHEN f.name ILIKE '3"%' AND f.name NOT ILIKE '3-1/%' THEN 8
    WHEN f.name ILIKE '3-1/2"%' THEN 9
    WHEN f.name ILIKE '4"%' THEN 10
    ELSE 99
  END,
  f.name;

-- ========================================
-- WHAT THIS DOES:
-- ========================================
-- ONE script automatically links:
-- - 1/2" fittings → 1/2" couplings/connectors
-- - 3/4" fittings → 3/4" couplings/connectors
-- - 1" fittings → 1" couplings/connectors
-- - ... and so on for ALL sizes!
--
-- No need to run separate scripts for each size!
-- ========================================
