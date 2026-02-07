-- Add customer_email column to invoices table
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS customer_email text;

-- Add index for faster email lookups
CREATE INDEX IF NOT EXISTS invoices_customer_email_idx ON invoices(customer_email);
