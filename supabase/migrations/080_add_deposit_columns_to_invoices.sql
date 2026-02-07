-- Add deposit columns to invoices table if they don't exist
ALTER TABLE invoices 
ADD COLUMN IF NOT EXISTS deposit_received NUMERIC(12,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS deposit_date DATE;

-- Add comments to document the columns
COMMENT ON COLUMN invoices.deposit_received IS 'Amount of deposit received from customer';
COMMENT ON COLUMN invoices.deposit_date IS 'Date when the deposit was received';
