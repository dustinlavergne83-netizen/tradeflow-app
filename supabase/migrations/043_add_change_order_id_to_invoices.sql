-- Add change_order_id column to invoices table
-- This allows us to link invoices to change orders

ALTER TABLE invoices 
ADD COLUMN IF NOT EXISTS change_order_id UUID REFERENCES change_orders(id) ON DELETE SET NULL;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_invoices_change_order_id ON invoices(change_order_id);

-- Add comment
COMMENT ON COLUMN invoices.change_order_id IS 'Links this invoice to a change order (optional)';
