-- Check if base_materials table has data

SELECT 
    id,
    name,
    category,
    price,
    labor_hours,
    unit
FROM base_materials
LIMIT 20;

-- Check how many materials have NULL or 0 values
SELECT 
    COUNT(*) as total_materials,
    COUNT(CASE WHEN price IS NULL OR price = 0 THEN 1 END) as materials_with_no_price,
    COUNT(CASE WHEN labor_hours IS NULL OR labor_hours = 0 THEN 1 END) as materials_with_no_labor
FROM base_materials;
