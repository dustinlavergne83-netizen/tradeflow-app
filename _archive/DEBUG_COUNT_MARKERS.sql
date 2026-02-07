-- Debug query to check count measurements and their markers
-- Run this in Supabase SQL Editor to see what's stored

SELECT 
  id,
  label,
  calculated_value as count,
  jsonb_array_length(geometry->'markers') as markers_in_db,
  geometry->'markers' as marker_data,
  page_number,
  created_at
FROM plan_measurements
WHERE measurement_type = 'count'
ORDER BY created_at DESC
LIMIT 10;

-- Check a specific measurement in detail
-- Replace 'YOUR_MEASUREMENT_ID' with the actual ID
/*
SELECT 
  id,
  label,
  calculated_value,
  jsonb_pretty(geometry) as geometry_formatted
FROM plan_measurements
WHERE id = 'YOUR_MEASUREMENT_ID';
*/
