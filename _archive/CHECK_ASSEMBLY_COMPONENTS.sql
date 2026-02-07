-- Check if assembly exists and has components
-- Replace with your actual assembly ID from the console: e80394c8-3ecc-45d9-adcc-b9f489934987

-- 1. Check the assembly itself
SELECT 
  id,
  name,
  description,
  category,
  unit,
  is_active
FROM assemblies 
WHERE id = 'e80394c8-3ecc-45d9-adcc-b9f489934987';

-- 2. Check how many components it has
SELECT 
  COUNT(*) as component_count
FROM assembly_components 
WHERE assembly_id = 'e80394c8-3ecc-45d9-adcc-b9f489934987';

-- 3. Show all components for this assembly
SELECT 
  id,
  assembly_id,
  material_id,
  material_name,
  quantity,
  unit,
  quantity_type,
  auto_add_coupling_id,
  auto_add_connector_id,
  sequence
FROM assembly_components 
WHERE assembly_id = 'e80394c8-3ecc-45d9-adcc-b9f489934987'
ORDER BY sequence;

-- 4. If no components, check if assembly was created properly
-- Show recent assemblies
SELECT 
  id,
  name,
  category,
  created_at,
  (SELECT COUNT(*) FROM assembly_components WHERE assembly_id = assemblies.id) as component_count
FROM assemblies 
WHERE name ILIKE '%2" EMT%'
ORDER BY created_at DESC
LIMIT 10;
