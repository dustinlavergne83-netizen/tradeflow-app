-- Check what's actually in the database for count measurements
SELECT 
  id,
  label,
  layer_id,
  page_number,
  calculated_value,
  jsonb_array_length(geometry->'markers') as marker_count,
  geometry->'markers' as markers_data,
  created_at
FROM plan_measurements
WHERE measurement_type = 'count'
ORDER BY created_at DESC
LIMIT 10;

-- This will show:
-- - How many count measurements you have
-- - How many markers are stored in each one
-- - The actual marker data (coordinates)
