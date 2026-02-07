-- CHECK IF YOU HAVE ANY WIRE MATERIALS

-- Check for THHN wire (for EMT/Rigid)
SELECT 
  name,
  category,
  unit,
  basecost,
  id
FROM base_materials
WHERE name ILIKE '%THHN%'
ORDER BY name;

-- Check for THWN wire (for PVC underground)
SELECT 
  name,
  category,
  unit,
  basecost,
  id
FROM base_materials
WHERE name ILIKE '%THWN%'
ORDER BY name;

-- Check for any wire at all
SELECT 
  name,
  category,
  unit,
  basecost,
  id
FROM base_materials
WHERE (
  name ILIKE '%wire%' OR
  name ILIKE '%thhn%' OR
  name ILIKE '%thwn%' OR
  name ILIKE '%#12%' OR
  name ILIKE '%#10%' OR
  name ILIKE '%#8%' OR
  name ILIKE '%#6%'
)
AND name NOT ILIKE '%wire nut%'
AND name NOT ILIKE '%wire marker%'
AND name NOT ILIKE '%wire identification%'
AND name NOT ILIKE '%wire pulling%'
AND name NOT ILIKE '%wire splice%'
ORDER BY name;
