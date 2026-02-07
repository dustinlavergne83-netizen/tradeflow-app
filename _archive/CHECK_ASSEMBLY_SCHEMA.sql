-- Check the data type of material_id in assembly_components
SELECT column_name, data_type, udt_name
FROM information_schema.columns
WHERE table_name = 'assembly_components'
  AND column_name = 'material_id';

-- Also check base_materials id type
SELECT column_name, data_type, udt_name
FROM information_schema.columns
WHERE table_name = 'base_materials'
  AND column_name = 'id';
