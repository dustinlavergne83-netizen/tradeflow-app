-- Check all count measurements and their marker coordinates
SELECT 
    id,
    label,
    page_number,
    jsonb_array_length(geometry->'markers') as marker_count,
    geometry->'markers' as markers
FROM plan_measurements
WHERE measurement_type = 'count'
ORDER BY created_at DESC;
