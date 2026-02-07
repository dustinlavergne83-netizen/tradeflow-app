-- Check ALL count measurements in database
SELECT 
    label,
    calculated_value as count,
    jsonb_array_length(geometry->'markers') as markers_count,
    geometry->'markers' as all_markers,
    created_at
FROM plan_measurements
WHERE measurement_type = 'count'
ORDER BY created_at DESC;
