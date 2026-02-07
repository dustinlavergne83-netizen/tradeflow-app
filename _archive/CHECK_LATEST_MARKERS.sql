-- Check the MOST RECENT count measurement (your new one)
SELECT 
    id,
    label,
    calculated_value as count,
    color,
    page_number,
    jsonb_array_length(geometry->'markers') as markers_saved,
    geometry->'markers' as marker_data,
    created_at
FROM plan_measurements
WHERE measurement_type = 'count'
ORDER BY created_at DESC
LIMIT 1;

-- Show each marker individually
SELECT 
    jsonb_array_elements(geometry->'markers')->>'x' as x,
    jsonb_array_elements(geometry->'markers')->>'y' as y
FROM plan_measurements
WHERE measurement_type = 'count'
ORDER BY created_at DESC
LIMIT 1;
