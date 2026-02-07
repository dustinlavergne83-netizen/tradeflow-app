-- Add materials array column to plan_measurements for storing multiple materials with quantities
-- This allows length measurements to have multiple associated materials

ALTER TABLE plan_measurements
ADD COLUMN IF NOT EXISTS materials JSONB DEFAULT '[]'::jsonb;

-- Add comment explaining the column
COMMENT ON COLUMN plan_measurements.materials IS 'Array of materials with quantities: [{material_id: "123", quantity: 5}, ...]';
