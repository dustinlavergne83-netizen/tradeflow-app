-- Add parametric calculation fields to assembly_components

-- Add new columns for quantity calculation
ALTER TABLE assembly_components
ADD COLUMN quantity_type TEXT DEFAULT 'fixed' CHECK (quantity_type IN ('fixed', 'per_foot', 'per_10_feet', 'per_100_feet', 'per_unit')),
ADD COLUMN quantity_formula TEXT, -- For future custom formulas like "CEIL(length/10)"
ADD COLUMN description TEXT; -- User-friendly description of what this component does

-- Comments to explain the fields
COMMENT ON COLUMN assembly_components.quantity_type IS 'How quantity is calculated: fixed (static qty), per_foot (qty per foot of measurement), per_10_feet (1 per 10ft like couplings), per_100_feet, per_unit (multiply by base quantity)';
COMMENT ON COLUMN assembly_components.quantity_formula IS 'Optional custom formula for advanced calculations (future use)';
COMMENT ON COLUMN assembly_components.description IS 'User-friendly description like "1 coupling needed per 10-foot stick"';

-- Example: Update existing components if needed (you can modify based on your data)
-- UPDATE assembly_components 
-- SET quantity_type = 'per_10_feet', description = '1 coupling per 10-foot stick'
-- WHERE material_name ILIKE '%coupling%';
