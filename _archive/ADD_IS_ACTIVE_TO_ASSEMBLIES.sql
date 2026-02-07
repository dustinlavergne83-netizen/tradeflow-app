-- Add missing columns to assemblies table
ALTER TABLE assemblies
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS unit VARCHAR(10) DEFAULT 'ea';

-- Update existing assemblies to be active and have unit
UPDATE assemblies
SET is_active = true,
    unit = 'ea'
WHERE is_active IS NULL OR unit IS NULL;

-- Add missing columns to assembly_components table
-- These columns are needed for the UI but weren't required for CSV bulk upload
ALTER TABLE assembly_components
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS labor_hours NUMERIC(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS material_id UUID;

-- Update existing components to have labor_hours
UPDATE assembly_components
SET labor_hours = 0
WHERE labor_hours IS NULL;

-- Add comments
COMMENT ON COLUMN assemblies.is_active IS 'Whether this assembly is active and visible to users';
COMMENT ON COLUMN assemblies.unit IS 'Unit of measurement for this assembly (e.g., ea, ft, sf)';
COMMENT ON COLUMN assembly_components.description IS 'Optional description for the component (e.g., "1 coupling per 10-foot stick")';
COMMENT ON COLUMN assembly_components.labor_hours IS 'Labor hours per unit for this component';
COMMENT ON COLUMN assembly_components.material_id IS 'Foreign key reference to the material in base_materials or custom_materials';
