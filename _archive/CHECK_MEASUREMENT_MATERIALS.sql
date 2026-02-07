-- Check what materials are saved for the most recent length measurement
SELECT 
  id,
  label,
  calculated_value as length_feet,
  materials,
  jsonb_array_length(materials) as material_count,
  created_at
FROM plan_measurements 
WHERE measurement_type = 'length' 
ORDER BY created_at DESC 
LIMIT 5;

-- Also check what the materials array contains in detail
SELECT 
  id,
  label,
  jsonb_array_elements(materials) as individual_material
FROM plan_measurements 
WHERE measurement_type = 'length' 
ORDER BY created_at DESC 
LIMIT 3;
