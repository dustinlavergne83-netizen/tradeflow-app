-- Get actual EMT conduit, connector, and strap material IDs from database

-- EMT Conduit
SELECT id, name, category, basecost 
FROM base_materials 
WHERE name ILIKE '%emt%' 
  AND name ILIKE '%conduit%'
  AND name NOT ILIKE '%rigid%'
ORDER BY name;

-- EMT Connectors
SELECT id, name, category, basecost 
FROM base_materials 
WHERE name ILIKE '%emt%' 
  AND name ILIKE '%connector%'
ORDER BY name;

-- EMT Straps
SELECT id, name, category, basecost 
FROM base_materials 
WHERE name ILIKE '%emt%' 
  AND name ILIKE '%strap%'
ORDER BY name;

-- 2/0 Green wire
SELECT id, name, category, basecost 
FROM base_materials 
WHERE name ILIKE '%2/0%' 
  AND name ILIKE '%green%'
ORDER BY name;
