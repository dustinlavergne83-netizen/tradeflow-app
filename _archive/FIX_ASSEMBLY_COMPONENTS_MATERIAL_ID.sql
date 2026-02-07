-- Fix assembly_components.material_id type mismatch
-- Change from UUID to TEXT to match base_materials.id

-- Step 1: Drop the foreign key constraint if it exists
ALTER TABLE assembly_components 
DROP CONSTRAINT IF EXISTS assembly_components_material_id_fkey;

-- Step 2: Change the column type from UUID to TEXT
ALTER TABLE assembly_components 
ALTER COLUMN material_id TYPE TEXT;

-- Step 3: Re-add the foreign key constraint
ALTER TABLE assembly_components
ADD CONSTRAINT assembly_components_material_id_fkey 
FOREIGN KEY (material_id) 
REFERENCES base_materials(id);

-- Verify the change
SELECT column_name, data_type, udt_name
FROM information_schema.columns
WHERE table_name = 'assembly_components'
  AND column_name = 'material_id';
