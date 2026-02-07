-- Check all measurements on the Fixtures layer for this plan

-- First, find the Fixtures layer ID
SELECT 
  id,
  name,
  section_name,
  is_predefined,
  color
FROM measurement_layers
WHERE section_name = 'Fixtures'
  AND is_predefined = true
ORDER BY created_at DESC;

-- Then check all count measurements on that layer
-- Replace 'LAYER_ID_HERE' with the actual ID from above
SELECT 
  id,
  label,
  measurement_type,
  calculated_value as count,
  layer_id,
  jsonb_array_length(geometry->'markers') as markers_in_db,
  geometry->'markers' as marker_data,
  created_at,
  color
FROM plan_measurements
WHERE layer_id IN (
  SELECT id 
  FROM measurement_layers 
  WHERE section_name = 'Fixtures' 
    AND is_predefined = true
)
AND measurement_type = 'count'
ORDER BY created_at DESC;

-- Check total markers across all layers to see if they moved
SELECT 
  ml.name as layer_name,
  ml.section_name,
  COUNT(pm.id) as measurement_count,
  SUM(pm.calculated_value) as total_markers
FROM measurement_layers ml
LEFT JOIN plan_measurements pm ON pm.layer_id = ml.id AND pm.measurement_type = 'count'
WHERE ml.is_predefined = true
GROUP BY ml.id, ml.name, ml.section_name, ml.display_order
ORDER BY ml.display_order;
