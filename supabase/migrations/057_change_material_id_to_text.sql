-- Change material_id column from uuid to text to support both CSV materials (string IDs) and custom materials (UUID IDs)

-- Step 1: Drop the foreign key constraint
ALTER TABLE plan_measurements 
  DROP CONSTRAINT IF EXISTS plan_measurements_material_id_fkey;

-- Step 2: Change column type to text
ALTER TABLE plan_measurements 
  ALTER COLUMN material_id TYPE text USING material_id::text;

-- Step 3: Update comment
COMMENT ON COLUMN plan_measurements.material_id IS 'Reference to material - can be UUID (custom_materials) or string ID (CSV materials). Not enforced with FK since materials come from two sources.';
