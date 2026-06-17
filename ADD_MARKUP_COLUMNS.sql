-- Add material_markup and labor_markup columns to estimates table
ALTER TABLE estimates 
ADD COLUMN IF NOT EXISTS material_markup NUMERIC(5,2) DEFAULT 0;

ALTER TABLE estimates 
ADD COLUMN IF NOT EXISTS labor_markup NUMERIC(5,2) DEFAULT 0;

-- Add same columns to change_orders table
ALTER TABLE change_orders 
ADD COLUMN IF NOT EXISTS material_markup NUMERIC(5,2) DEFAULT 0;

ALTER TABLE change_orders 
ADD COLUMN IF NOT EXISTS labor_markup NUMERIC(5,2) DEFAULT 0;

-- Comments for documentation
COMMENT ON COLUMN estimates.material_markup IS 'Material markup percentage applied to material costs (e.g. 20 = 20%)';
COMMENT ON COLUMN estimates.labor_markup IS 'Labor markup percentage applied to labor costs (e.g. 15 = 15%)';
COMMENT ON COLUMN change_orders.material_markup IS 'Material markup percentage applied to material costs';
COMMENT ON COLUMN change_orders.labor_markup IS 'Labor markup percentage applied to labor costs';
