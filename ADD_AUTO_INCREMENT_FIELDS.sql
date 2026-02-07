-- Add auto-increment fields to assembly_components table
-- This allows fittings to specify which coupling/connector should be auto-added

-- Add column for auto-adding couplings (for 90°, 45° fittings)
ALTER TABLE assembly_components
ADD COLUMN IF NOT EXISTS auto_add_coupling_id TEXT REFERENCES base_materials(id);

-- Add column for auto-adding connectors (for LB, LL, LR bodies)
ALTER TABLE assembly_components
ADD COLUMN IF NOT EXISTS auto_add_connector_id TEXT REFERENCES base_materials(id);

-- Add comments to explain the fields
COMMENT ON COLUMN assembly_components.auto_add_coupling_id IS 
'Material ID of coupling to auto-add when this fitting is used (for 90°, 45° fittings)';

COMMENT ON COLUMN assembly_components.auto_add_connector_id IS 
'Material ID of connector to auto-add when this fitting is used (for LB, LL, LR bodies - adds 2 connectors)';

-- Example: Update a 3/4" EMT 90° fitting to auto-add its matching coupling
-- UPDATE assembly_components 
-- SET auto_add_coupling_id = (SELECT id FROM base_materials WHERE name = '3/4" EMT Set-Screw Coupling' LIMIT 1)
-- WHERE material_name LIKE '%3/4%' AND material_name LIKE '%90%' AND material_name LIKE '%EMT%';

-- Example: Update a 3/4" EMT LB body to auto-add its matching connector
-- UPDATE assembly_components 
-- SET auto_add_connector_id = (SELECT id FROM base_materials WHERE name = '3/4" EMT Set-Screw Connector' LIMIT 1)
-- WHERE material_name LIKE '%3/4%' AND material_name LIKE '%LB%' AND material_name LIKE '%EMT%';
