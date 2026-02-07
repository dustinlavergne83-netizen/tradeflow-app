-- Add markup_percentage column to invoice_items table
ALTER TABLE invoice_items 
ADD COLUMN IF NOT EXISTS markup_percentage DECIMAL(5, 2) DEFAULT 0;

-- Add comment to explain the column
COMMENT ON COLUMN invoice_items.markup_percentage IS 'Markup percentage applied to the item total';
