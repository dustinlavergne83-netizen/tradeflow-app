-- ================================================================
-- FIX DUPLICATE EMT MATERIALS
-- ================================================================
-- This identifies and handles materials that would create duplicates
-- Run this BEFORE the migration to clean up conflicts
-- ================================================================

-- ================================================================
-- STEP 1: Find materials that would create duplicates
-- ================================================================

-- Check for materials where multiple OLD ids would map to same NEW id
WITH target_mappings AS (
  SELECT 
    id as current_id,
    name,
    CASE 
      WHEN name ILIKE '%1-1/4%' OR name ILIKE '%1 1/4%' THEN '125'
      WHEN name ILIKE '%1-1/2%' OR name ILIKE '%1 1/2%' THEN '15'
      WHEN name ILIKE '%2-1/2%' OR name ILIKE '%2 1/2%' THEN '25'
      WHEN name ILIKE '%3-1/2%' OR name ILIKE '%3 1/2%' THEN '35'
      WHEN name ILIKE '%1/2%' THEN '05'
      WHEN name ILIKE '%3/4%' THEN '075'
      WHEN name ~ '1"' AND name NOT ILIKE '%1/4%' AND name NOT ILIKE '%1/2%' THEN '1'
      WHEN name ~ '2"' AND name NOT ILIKE '%1/2%' THEN '2'
      WHEN name ~ '3"' AND name NOT ILIKE '%1/2%' THEN '3'
      WHEN name ~ '4"' THEN '4'
    END as size_code,
    CASE
      WHEN name ILIKE '%conduit%' AND name NOT ILIKE '%fitting%' AND name NOT ILIKE '%connector%' 
           AND name NOT ILIKE '%coupling%' AND name NOT ILIKE '%elbow%' THEN ''
      WHEN name ILIKE '%90%' OR (name ILIKE '%elbow%' AND name NOT ILIKE '%45%') THEN '_90'
      WHEN name ILIKE '%45%' THEN '_45'
      WHEN name ILIKE '%connector%' AND name ILIKE '%set%screw%' THEN '_ssconn'
      WHEN name ILIKE '%connector%' AND name ILIKE '%compression%' THEN '_cpconn'
      WHEN name ILIKE '%connector%' THEN '_ssconn'
      WHEN name ILIKE '%coupling%' AND name ILIKE '%set%screw%' THEN '_sscpl'
      WHEN name ILIKE '%coupling%' AND name ILIKE '%compression%' THEN '_cpcpl'
      WHEN name ILIKE '%coupling%' THEN '_sscpl'
      WHEN name ILIKE '%strap%' OR name ILIKE '%clamp%' THEN '_strap'
      ELSE '_other'
    END as component,
    basecost,
    laborhours
  FROM base_materials
  WHERE name ILIKE '%EMT%'
)
SELECT 
  'Duplicate Conflicts' as issue,
  CONCAT('emt', size_code, component) as target_id,
  COUNT(*) as count_of_materials,
  STRING_AGG(current_id, ', ') as current_ids,
  STRING_AGG(name, ' | ') as names
FROM target_mappings
WHERE size_code IS NOT NULL
GROUP BY CONCAT('emt', size_code, component)
HAVING COUNT(*) > 1
ORDER BY COUNT(*) DESC;

-- ================================================================
-- STEP 2: Show all materials that would have conflicts
-- ================================================================

SELECT 
  'Materials Creating Conflicts' as info,
  id,
  name,
  basecost,
  laborhours,
  category
FROM base_materials
WHERE name ILIKE '%1/2%' AND name ILIKE '%EMT%' 
  AND (name ILIKE '%90%' OR (name ILIKE '%elbow%' AND name NOT ILIKE '%45%'))
ORDER BY name;

-- ================================================================
-- STEP 3: SOLUTION - Delete placeholder/duplicate materials
-- ================================================================
-- Keep the materials with actual cost/labor data
-- Delete placeholders (basecost = 0 and laborhours = 0)

BEGIN;

-- Delete placeholder materials that would conflict
DELETE FROM base_materials
WHERE name ILIKE '%EMT%'
  AND basecost = 0
  AND laborhours = 0
  AND category = 'placeholder';

-- Verify what's left
SELECT 
  'Remaining Materials After Cleanup' as status,
  id,
  name,
  basecost,
  laborhours
FROM base_materials
WHERE name ILIKE '%1/2%' AND name ILIKE '%EMT%';

COMMIT;
