-- First, let's see what assemblies exist with $0.00 cost
-- Run this FIRST to see the exact names in your database

SELECT 
  id,
  name,
  total_material_cost,
  total_labor_hours,
  company_id
FROM assemblies
WHERE (total_material_cost = 0 OR total_material_cost IS NULL)
  AND is_active = true
ORDER BY name;

-- This will show you the exact names so we can match them properly
