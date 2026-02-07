-- ========================================
-- MERGE ASSEMBLY COMPONENTS TABLES
-- Combines assembly_components and assembly_components_resolved
-- ========================================

-- Step 1: Backup existing data (optional but recommended)
-- You can skip this if you're confident, but it's good practice

-- Step 2: Ensure assembly_components has all necessary columns from both tables
-- Add any missing columns that exist in assembly_components_resolved
ALTER TABLE assembly_components
ADD COLUMN IF NOT EXISTS placeholder_id TEXT,
ADD COLUMN IF NOT EXISTS fitting_category TEXT,
ADD COLUMN IF NOT EXISTS option_type TEXT,
ADD COLUMN IF NOT EXISTS actual_material_id TEXT,
ADD COLUMN IF NOT EXISTS component_quantity NUMERIC(10,2),
ADD COLUMN IF NOT EXISTS component_quantity_type TEXT,
ADD COLUMN IF NOT EXISTS component_description TEXT,
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP;

-- Step 3: Copy all data from assembly_components_resolved into assembly_components
-- This will preserve all your CSV uploaded data
INSERT INTO assembly_components (
  assembly_id,
  component_material_id,
  placeholder_id,
  fitting_category,
  option_type,
  actual_material_id,
  component_quantity,
  component_quantity_type,
  component_description
)
SELECT 
  acr.assembly_id,
  acr.actual_material_id,  -- component_material_id is NOT NULL, so use actual_material_id
  acr.placeholder_id,
  acr.fitting_category,
  acr.option_type,
  acr.actual_material_id,
  acr.component_quantity,
  acr.component_quantity_type,
  acr.component_description
FROM assembly_components_resolved acr
WHERE NOT EXISTS (
  -- Avoid duplicates by checking if the component already exists
  SELECT 1 FROM assembly_components ac
  WHERE ac.assembly_id = acr.assembly_id
    AND COALESCE(ac.actual_material_id, ac.component_material_id) = acr.actual_material_id
    AND COALESCE(ac.component_quantity, 0) = COALESCE(acr.component_quantity, 0)
);

-- Step 4: Create a view called assembly_components_resolved that points to assembly_components
-- This ensures any code still referencing the old table will continue to work
CREATE OR REPLACE VIEW assembly_components_resolved AS
SELECT * FROM assembly_components;

-- Step 5: Add helpful comments
COMMENT ON TABLE assembly_components IS 'Unified table containing all assembly components from both manual entry and CSV imports';
COMMENT ON COLUMN assembly_components.placeholder_id IS 'Used for CSV imports to identify component type';
COMMENT ON COLUMN assembly_components.fitting_category IS 'Category of fitting (for straps/connectors)';
COMMENT ON COLUMN assembly_components.option_type IS 'Option type for standardized vs specialized components';
COMMENT ON COLUMN assembly_components.actual_material_id IS 'Material identifier (can be material name or ID)';
COMMENT ON COLUMN assembly_components.component_quantity IS 'Base quantity of this component';
COMMENT ON COLUMN assembly_components.component_quantity_type IS 'How quantity is calculated (fixed, per_foot, etc)';
COMMENT ON COLUMN assembly_components.component_description IS 'Optional description of the component';

-- Step 6: Grant same permissions to the view as the table
GRANT SELECT ON assembly_components_resolved TO authenticated;
GRANT SELECT ON assembly_components_resolved TO anon;

-- ========================================
-- VERIFICATION QUERIES
-- Run these after the migration to verify everything worked
-- ========================================

-- Check total count in assembly_components (should be ~6,685 records)
-- SELECT COUNT(*) as total_components FROM assembly_components;

-- Check that the view works
-- SELECT COUNT(*) as total_from_view FROM assembly_components_resolved;

-- View sample data
-- SELECT * FROM assembly_components LIMIT 10;

-- Check for any assemblies with components
-- SELECT a.name, COUNT(ac.id) as component_count
-- FROM assemblies a
-- LEFT JOIN assembly_components ac ON a.id = ac.assembly_id
-- GROUP BY a.id, a.name
-- ORDER BY component_count DESC
-- LIMIT 20;
