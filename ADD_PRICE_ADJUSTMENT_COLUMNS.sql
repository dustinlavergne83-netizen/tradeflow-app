-- Add price adjustment columns to estimates table
ALTER TABLE estimates 
ADD COLUMN IF NOT EXISTS price_adjustment_applied BOOLEAN DEFAULT FALSE;

ALTER TABLE estimates 
ADD COLUMN IF NOT EXISTS price_adjustment_details JSONB;

-- Add price adjustment columns to change_orders table  
ALTER TABLE change_orders 
ADD COLUMN IF NOT EXISTS price_adjustment_applied BOOLEAN DEFAULT FALSE;

ALTER TABLE change_orders 
ADD COLUMN IF NOT EXISTS price_adjustment_details JSONB;

-- Add comment for documentation
COMMENT ON COLUMN estimates.price_adjustment_applied IS 'True if a price adjustment has been applied to this estimate';
COMMENT ON COLUMN estimates.price_adjustment_details IS 'JSON details of the price adjustment (type, value, rounding, etc.)';
COMMENT ON COLUMN change_orders.price_adjustment_applied IS 'True if a price adjustment has been applied to this change order';
COMMENT ON COLUMN change_orders.price_adjustment_details IS 'JSON details of the price adjustment (type, value, rounding, etc.)';