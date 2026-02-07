-- Check what IDs the EMT conduit actually has in the database
SELECT id, name FROM base_materials 
WHERE name LIKE '%EMT Conduit%' 
ORDER BY name;

-- Check EMT connectors
SELECT id, name FROM base_materials 
WHERE name LIKE '%EMT Set Screw Connector%' 
ORDER BY name;

-- Check EMT straps
SELECT id, name FROM base_materials 
WHERE name LIKE '%EMT 1-Hole Strap%' 
ORDER BY name;
