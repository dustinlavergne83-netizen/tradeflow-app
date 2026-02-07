/* Add material_id to plan_measurements to link counts to materials */

ALTER TABLE plan_measurements
ADD COLUMN IF NOT EXISTS material_id UUID REFERENCES custom_materials(id) ON DELETE SET NULL;

/* Add index for faster lookups */
CREATE INDEX IF NOT EXISTS idx_plan_measurements_material_id ON plan_measurements(material_id);

/* Add a note column for additional details */
ALTER TABLE plan_measurements
ADD COLUMN IF NOT EXISTS notes TEXT;
