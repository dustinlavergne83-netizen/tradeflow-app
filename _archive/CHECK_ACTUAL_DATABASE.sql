-- Let's check what's actually in the base_materials table

-- Check the first 10 materials to see what columns exist
SELECT 
    id,
    name,
    category,
    cost,
    price,
    labor_hours,
    unit
FROM base_materials
WHERE category = 'Fittings'
LIMIT 10;

-- Check if cost column has data
SELECT 
    COUNT(*) as total_materials,
    COUNT(CASE WHEN cost IS NOT NULL AND cost > 0 THEN 1 END) as materials_with_cost,
    COUNT(CASE WHEN price IS NOT NULL AND price > 0 THEN 1 END) as materials_with_price
FROM base_materials;

-- Show actual data for the materials you showed in the screenshot
SELECT 
    name,
    cost,
    price,
    labor_hours
FROM base_materials
WHERE name LIKE '%EMT%Elbow%'
   OR name LIKE '%Close Nipple%'
   OR name LIKE '%EMT%Strap%'
ORDER BY name
LIMIT 20;
