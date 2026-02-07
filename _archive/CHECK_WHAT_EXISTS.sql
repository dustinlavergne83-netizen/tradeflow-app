-- Simple check: What tables and columns exist?

-- 1. Check if assembly_components table exists
SELECT 
  column_name, 
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'assembly_components'
ORDER BY ordinal_position;

-- 2. Show ALL assemblies and their component counts
SELECT 
  a.id,
  a.name,
  a.category,
  a.is_active,
  COUNT(ac.id) as component_count
FROM assemblies a
LEFT JOIN assembly_components ac ON ac.assembly_id = a.id
WHERE a.name ILIKE '%EMT%'
GROUP BY a.id, a.name, a.category, a.is_active
ORDER BY a.created_at DESC
LIMIT 20;

-- 3. Show ALL components for ALL assemblies (limited to 50)
SELECT 
  ac.id,
  ac.assembly_id,
  a.name as assembly_name,
  ac.material_id,
  ac.material_name,
  ac.quantity,
  ac.sequence
FROM assembly_components ac
JOIN assemblies a ON a.id = ac.assembly_id
WHERE a.name ILIKE '%EMT%'
ORDER BY a.name, ac.sequence
LIMIT 50;
