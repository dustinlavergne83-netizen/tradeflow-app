-- Check the purple marker measurement (V = 5 items)
-- This will show us all 5 markers and their coordinates

SELECT 
    id,
    label,
    calculated_value as count,
    color,
    jsonb_array_length(geometry->'markers') as markers_in_db,
    geometry->'markers' as all_markers
FROM plan_measurements
WHERE measurement_type = 'count'
AND label = 'V'
ORDER BY created_at DESC
LIMIT 1;

-- Also show each individual marker
SELECT 
    label,
    jsonb_array_elements(geometry->'markers') as individual_marker
FROM plan_measurements
WHERE measurement_type = 'count'
AND label = 'V';
