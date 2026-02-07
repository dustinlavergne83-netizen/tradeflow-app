-- Add columns to assembly_components to specify which materials should be auto-added
-- This allows each component to declare exactly what couplings/connectors/etc to add
-- instead of relying on name parsing

ALTER TABLE assembly_components
ADD COLUMN auto_add_coupling_id UUID REFERENCES base_materials(id),
ADD COLUMN auto_add_connector_id UUID REFERENCES base_materials(id);

-- Add comments to document the purpose
COMMENT ON COLUMN assembly_components.auto_add_coupling_id IS 'Material ID to auto-add as coupling when this component is used (e.g., for elbows/45s)';
COMMENT ON COLUMN assembly_components.auto_add_connector_id IS 'Material ID to auto-add as connector when this component is used (e.g., for bodies)';
