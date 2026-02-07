-- Check measurement B's markers
SELECT 
    label,
    calculated_value as count_shown,
    jsonb_array_length(geometry->'markers') as markers_in_db,
    geometry->'markers' as all_markers
FROM plan_measurements
WHERE measurement_type = 'count'
AND label = 'B'
ORDER BY created_at DESC
LIMIT 1;
