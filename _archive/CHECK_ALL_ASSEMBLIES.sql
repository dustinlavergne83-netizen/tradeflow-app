-- Let's see ALL assemblies to understand what's there
SELECT 
  id,
  name,
  total_material_cost,
  total_labor_hours,
  is_active
FROM assemblies
ORDER BY total_material_cost, name
LIMIT 100;

-- Count total assemblies
SELECT COUNT(*) as total_assemblies FROM assemblies WHERE is_active = true;
