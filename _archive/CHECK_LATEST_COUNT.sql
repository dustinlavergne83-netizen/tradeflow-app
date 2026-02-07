-- Check the most recent count measurement
SELECT 
  id,
  label,
  calculated_value as count,
  jsonb_array_length(geometry->'markers') as markers_in_db,
  geometry->'markers' as marker_coords,
  page_number,
  created_at
FROM plan_measurements
WHERE measurement_type = 'count'
ORDER BY created_at DESC
LIMIT 1;
