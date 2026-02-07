-- Comprehensive analysis of all fitting materials to understand current ID structure

-- 1. Check all EMT fittings
SELECT 'EMT FITTINGS' as category, id, name, category as cat, unit
FROM base_materials 
WHERE name ILIKE '%EMT%' 
  AND (name ILIKE '%fitting%' OR name ILIKE '%coupling%' OR name ILIKE '%connector%' 
       OR name ILIKE '%elbow%' OR name ILIKE '%LB%' OR name ILIKE '%LL%' 
       OR name ILIKE '%LR%' OR name ILIKE '%T%' OR name ILIKE '%C%'
       OR name ILIKE '%strut%' OR name ILIKE '%strap%' OR name ILIKE '%clamp%')
ORDER BY name;

-- 2. Check all Rigid fittings
SELECT 'RIGID FITTINGS' as category, id, name, category as cat, unit
FROM base_materials 
WHERE name ILIKE '%Rigid%' AND name NOT ILIKE '%Semi%'
  AND (name ILIKE '%fitting%' OR name ILIKE '%coupling%' OR name ILIKE '%connector%' 
       OR name ILIKE '%elbow%' OR name ILIKE '%LB%' OR name ILIKE '%LL%' 
       OR name ILIKE '%LR%' OR name ILIKE '%T%' OR name ILIKE '%C%'
       OR name ILIKE '%strut%' OR name ILIKE '%strap%' OR name ILIKE '%clamp%'
       OR name ILIKE '%bushing%' OR name ILIKE '%locknut%')
ORDER BY name;

-- 3. Check all PVC fittings
SELECT 'PVC FITTINGS' as category, id, name, category as cat, unit
FROM base_materials 
WHERE name ILIKE '%PVC%'
  AND (name ILIKE '%fitting%' OR name ILIKE '%coupling%' OR name ILIKE '%connector%' 
       OR name ILIKE '%elbow%' OR name ILIKE '%LB%' OR name ILIKE '%LL%' 
       OR name ILIKE '%LR%' OR name ILIKE '%T%' OR name ILIKE '%sweep%'
       OR name ILIKE '%strap%' OR name ILIKE '%clamp%' OR name ILIKE '%cement%')
ORDER BY name;

-- 4. Check all conduit (pipes) to see the ID pattern
SELECT 'EMT CONDUIT' as category, id, name, category as cat, unit
FROM base_materials 
WHERE name ILIKE '%EMT%' 
  AND name NOT ILIKE '%fitting%' 
  AND name NOT ILIKE '%coupling%' 
  AND name NOT ILIKE '%connector%' 
  AND name NOT ILIKE '%elbow%'
  AND name NOT ILIKE '%strap%'
  AND name NOT ILIKE '%strut%'
  AND (name ILIKE '%conduit%' OR name ILIKE '%" EMT%' OR name ~ '^\d+/\d+" EMT$' OR name ~ '^\d+" EMT$')
ORDER BY 
  CASE 
    WHEN name ILIKE '%1/2%' THEN 1
    WHEN name ILIKE '%3/4%' THEN 2
    WHEN name ILIKE '%1"%' OR name ~ '^1" ' THEN 3
    WHEN name ILIKE '%1-1/4%' OR name ILIKE '%1 1/4%' THEN 4
    WHEN name ILIKE '%1-1/2%' OR name ILIKE '%1 1/2%' THEN 5
    WHEN name ILIKE '%2"%' OR name ~ '^2" ' THEN 6
    WHEN name ILIKE '%2-1/2%' OR name ILIKE '%2 1/2%' THEN 7
    WHEN name ILIKE '%3"%' OR name ~ '^3" ' THEN 8
    WHEN name ILIKE '%3-1/2%' OR name ILIKE '%3 1/2%' THEN 9
    WHEN name ILIKE '%4"%' OR name ~ '^4" ' THEN 10
    ELSE 99
  END;

-- 5. Check Rigid conduit
SELECT 'RIGID CONDUIT' as category, id, name, category as cat, unit
FROM base_materials 
WHERE name ILIKE '%Rigid%' AND name NOT ILIKE '%Semi%'
  AND name NOT ILIKE '%fitting%' 
  AND name NOT ILIKE '%coupling%' 
  AND name NOT ILIKE '%connector%' 
  AND name NOT ILIKE '%elbow%'
  AND name NOT ILIKE '%strap%'
  AND name NOT ILIKE '%bushing%'
  AND name NOT ILIKE '%locknut%'
  AND (name ILIKE '%conduit%' OR name ILIKE '%Rigid%')
ORDER BY name;

-- 6. Check PVC conduit
SELECT 'PVC CONDUIT' as category, id, name, category as cat, unit
FROM base_materials 
WHERE name ILIKE '%PVC%'
  AND name NOT ILIKE '%fitting%' 
  AND name NOT ILIKE '%coupling%' 
  AND name NOT ILIKE '%connector%' 
  AND name NOT ILIKE '%elbow%'
  AND name NOT ILIKE '%strap%'
  AND name NOT ILIKE '%cement%'
  AND (name ILIKE '%conduit%' OR name ILIKE '%Schedule%')
ORDER BY name;

-- 7. Show pattern of all material IDs to understand current structure
SELECT 
  LEFT(id, 3) as id_prefix,
  COUNT(*) as count,
  MIN(name) as example_name
FROM base_materials
GROUP BY LEFT(id, 3)
ORDER BY id_prefix;

-- 8. Check assembly components to see what material IDs are being used
SELECT DISTINCT 
  ac.material_id,
  bm.name,
  bm.category,
  COUNT(*) as times_used
FROM assembly_components ac
JOIN base_materials bm ON ac.material_id = bm.id
GROUP BY ac.material_id, bm.name, bm.category
ORDER BY times_used DESC, bm.name
LIMIT 100;
