-- Find what materials would create emt12_sscpl duplicate
SELECT 
  'Materials that would become emt12_sscpl' as issue,
  id as current_id,
  name,
  basecost,
  laborhours
FROM base_materials
WHERE name ILIKE '%1/2%' 
  AND name NOT ILIKE '%1-1/2%' 
  AND name NOT ILIKE '%2-1/2%'
  AND name NOT ILIKE '%3-1/2%'
  AND name ILIKE '%EMT%' 
  AND name ILIKE '%coupling%'
  AND (name ILIKE '%set%screw%' OR name NOT ILIKE '%compression%') 
  AND name NOT ILIKE '%connector%'
ORDER BY name;
