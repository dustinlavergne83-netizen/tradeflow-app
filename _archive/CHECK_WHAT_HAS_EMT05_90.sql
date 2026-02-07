-- Check what material currently has id='emt05_90'
SELECT 
  'Material with emt05_90 id' as info,
  id,
  name,
  category,
  basecost,
  laborhours
FROM base_materials
WHERE id = 'emt05_90';

-- Check all materials with '90' or 'elbow' in 1/2"
SELECT 
  'All 1/2 inch 90 degree materials' as info,
  id,
  name,
  category
FROM base_materials  
WHERE name ILIKE '%1/2%' 
  AND name NOT ILIKE '%1-1/2%'
  AND name NOT ILIKE '%2-1/2%'
  AND name ILIKE '%EMT%' 
  AND (name ILIKE '%90%' OR (name ILIKE '%elbow%' AND name NOT ILIKE '%45%'))
ORDER BY name;
