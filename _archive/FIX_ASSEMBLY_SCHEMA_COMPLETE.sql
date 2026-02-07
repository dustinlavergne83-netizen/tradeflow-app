-- ========================================
-- COMPLETE ASSEMBLY SCHEMA FIX
-- This adds ALL missing columns that the UI expects
-- ========================================

-- Fix assemblies table
ALTER TABLE assemblies
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS unit VARCHAR(10) DEFAULT 'ea';

UPDATE assemblies
SET is_active = true,
    unit = 'ea'
WHERE is_active IS NULL OR unit IS NULL;

-- Fix assembly_components table - ADD ALL MISSING COLUMNS
ALTER TABLE assembly_components
ADD COLUMN IF NOT EXISTS material_id UUID,
ADD COLUMN IF NOT EXISTS material_name TEXT,
ADD COLUMN IF NOT EXISTS quantity NUMERIC(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS unit VARCHAR(10) DEFAULT 'ea',
ADD COLUMN IF NOT EXISTS material_unit_cost NUMERIC(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS labor_hours NUMERIC(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS quantity_type VARCHAR(20) DEFAULT 'fixed',
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS sequence INTEGER DEFAULT 0;

-- Update existing components with defaults
UPDATE assembly_components
SET 
  quantity = COALESCE(quantity, 0),
  unit = COALESCE(unit, 'ea'),
  material_unit_cost = COALESCE(material_unit_cost, 0),
  labor_hours = COALESCE(labor_hours, 0),
  quantity_type = COALESCE(quantity_type, 'fixed'),
  sequence = COALESCE(sequence, 0)
WHERE quantity IS NULL 
   OR unit IS NULL 
   OR material_unit_cost IS NULL 
   OR labor_hours IS NULL 
   OR quantity_type IS NULL 
   OR sequence IS NULL;

-- Add helpful comments
COMMENT ON COLUMN assemblies.is_active IS 'Whether this assembly is active and visible to users';
COMMENT ON COLUMN assemblies.unit IS 'Unit of measurement for this assembly (e.g., ea, ft, sf)';
COMMENT ON COLUMN assembly_components.material_id IS 'Foreign key reference to base_materials or custom_materials';
COMMENT ON COLUMN assembly_components.material_name IS 'Cached name of the material for display';
COMMENT ON COLUMN assembly_components.quantity IS 'Base quantity of this component';
COMMENT ON COLUMN assembly_components.unit IS 'Unit of measurement (ea, ft, etc.)';
COMMENT ON COLUMN assembly_components.material_unit_cost IS 'Cost per unit of this material';
COMMENT ON COLUMN assembly_components.labor_hours IS 'Labor hours per unit';
COMMENT ON COLUMN assembly_components.quantity_type IS 'How quantity is calculated: fixed, per_foot, per_10_feet, per_100_feet';
COMMENT ON COLUMN assembly_components.description IS 'Optional description (e.g., "1 coupling per 10-foot stick")';
COMMENT ON COLUMN assembly_components.sequence IS 'Display order of components within assembly';
