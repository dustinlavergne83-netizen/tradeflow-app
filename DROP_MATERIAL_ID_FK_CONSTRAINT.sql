-- Drop the foreign key constraint on material_id
-- This allows us to store material IDs as text from both base_materials and custom_materials
-- without requiring a foreign key relationship

ALTER TABLE assembly_components 
DROP CONSTRAINT IF EXISTS assembly_components_material_id_fkey;

-- Verify the constraint is gone
SELECT constraint_name, constraint_type 
FROM information_schema.table_constraints 
WHERE table_name = 'assembly_components' 
  AND constraint_name LIKE '%material_id%';
