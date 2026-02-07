-- ================================================================
-- VERIFY EMT MATERIALS IMPORT
-- ================================================================
-- Check what EMT materials are currently in the database
-- ================================================================

-- Count by size
SELECT 
  'Materials by Size' as report,
  CASE 
    WHEN id LIKE 'emt12%' THEN '1/2"'
    WHEN id LIKE 'emt34%' THEN '3/4"'
    WHEN id LIKE 'emt1_%' OR id = 'emt1' THEN '1"'
    WHEN id LIKE 'emt114%' THEN '1-1/4"'
    WHEN id LIKE 'emt112%' THEN '1-1/2"'
    WHEN id LIKE 'emt2_%' OR id = 'emt2' THEN '2"'
    WHEN id LIKE 'emt212%' THEN '2-1/2"'
    WHEN id LIKE 'emt3%' THEN '3"'
    WHEN id LIKE 'emt4%' THEN '4"'
    ELSE 'Other'
  END as size,
  COUNT(*) as count
FROM base_materials
WHERE id LIKE 'emt%'
GROUP BY size
ORDER BY size;

-- Count by component type
SELECT 
  'Materials by Component Type' as report,
  CASE 
    WHEN id ~ '_90$' THEN '90° Elbow'
    WHEN id ~ '_45$' THEN '45° Elbow'
    WHEN id ~ '_ssconn$' THEN 'Set-Screw Connector'
    WHEN id ~ '_cpconn$' THEN 'Compression Connector'
    WHEN id ~ '_sscpl$' THEN 'Set-Screw Coupling'
    WHEN id ~ '_cpcpl$' THEN 'Compression Coupling'
    WHEN id ~ '_flexcpl$' THEN 'Flex Coupling'
    WHEN id ~ '_lb$' THEN 'LB Body'
    WHEN id ~ '_ll$' THEN 'LL Body'
    WHEN id ~ '_lr$' THEN 'LR Body'
    WHEN id ~ '_1hole$' THEN '1-Hole Strap'
    WHEN id ~ '_2hole$' THEN '2-Hole Strap'
    WHEN id ~ '_strap$' THEN 'Strap'
    WHEN id ~ '_standoff$' THEN 'Standoff'
    WHEN id ~ '_bushing$' THEN 'Bushing'
    WHEN id ~ '_bender$' THEN 'Bender'
    WHEN id IN ('emt12', 'emt34', 'emt1', 'emt114', 'emt112', 'emt2', 'emt212', 'emt3', 'emt4') THEN 'Conduit'
    ELSE 'Other'
  END as component_type,
  COUNT(*) as count
FROM base_materials
WHERE id LIKE 'emt%'
GROUP BY component_type
ORDER BY count DESC;

-- Total count
SELECT 
  'Total EMT Materials' as report,
  COUNT(*) as total_count
FROM base_materials
WHERE id LIKE 'emt%';

-- Show all materials (for detailed review)
SELECT 
  'All EMT Materials' as report,
  id,
  name,
  basecost,
  laborhours,
  category,
  unit
FROM base_materials
WHERE id LIKE 'emt%'
ORDER BY id;
