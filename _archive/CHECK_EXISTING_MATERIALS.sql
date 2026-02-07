-- Check all EMT materials to see what needs reorganizing
SELECT id, name, category, unit
FROM base_materials 
WHERE name ILIKE '%EMT%'
ORDER BY 
  CASE 
    WHEN name ILIKE '%1/2%' THEN 1
    WHEN name ILIKE '%3/4%' THEN 2
    WHEN name ILIKE '%1-1/4%' OR name ILIKE '%1 1/4%' THEN 3
    WHEN name ILIKE '%1-1/2%' OR name ILIKE '%1 1/2%' THEN 4
    WHEN name ILIKE '%2-1/2%' OR name ILIKE '%2 1/2%' THEN 5
    WHEN name ILIKE '%3-1/2%' OR name ILIKE '%3 1/2%' THEN 6
    WHEN name ILIKE '%1"%' THEN 7
    WHEN name ILIKE '%2"%' THEN 8
    WHEN name ILIKE '%3"%' THEN 9
    WHEN name ILIKE '%4"%' THEN 10
    ELSE 99
  END,
  name;

-- Also check Rigid materials
SELECT id, name, category, unit
FROM base_materials 
WHERE name ILIKE '%Rigid%' AND name NOT ILIKE '%Semi%'
ORDER BY name
LIMIT 50;

-- Check PVC materials
SELECT id, name, category, unit
FROM base_materials 
WHERE name ILIKE '%PVC%'
ORDER BY name
LIMIT 50;
