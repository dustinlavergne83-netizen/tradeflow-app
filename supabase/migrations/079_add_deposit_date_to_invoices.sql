-- Add deposit_date column to invoices table
ALTER TABLE invoices ADD COLUMN deposit_date DATE;

-- Add comment to document the column
COMMENT ON COLUMN invoices.deposit_date IS 'Date when the deposit was received';
