-- Diagnostic query to check what layers exist and their properties

-- First, check ALL layers in the database
SELECT 
  id,
  plan_id,
  name,
  section_name,
  color,
  is_predefined,
  display_order,
  visible,
  created_at
FROM measurement_layers
ORDER BY plan_id, is_predefined DESC, display_order NULLS LAST;

-- Count predefined vs custom layers
SELECT 
  is_predefined,
  COUNT(*) as count
FROM measurement_layers
GROUP BY is_predefined;

-- Check if the 7 predefined layer names exist at all
SELECT 
  name,
  COUNT(*) as count,
  SUM(CASE WHEN is_predefined THEN 1 ELSE 0 END) as predefined_count,
  SUM(CASE WHEN NOT is_predefined THEN 1 ELSE 0 END) as not_predefined_count
FROM measurement_layers
WHERE name IN ('Fixtures', 'Power', 'Branch', 'Feeders', 'Switchgear', 'Equipment', 'Special Systems')
GROUP BY name
ORDER BY name;
