-- Add vendor_id column to expenses table
ALTER TABLE expenses 
ADD COLUMN IF NOT EXISTS vendor_id UUID REFERENCES vendors(id) ON DELETE SET NULL;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_expenses_vendor ON expenses(vendor_id);

-- Optionally migrate existing vendor names to vendor_id (manual step after running this)
-- This would require matching vendor names in expenses.vendor to vendors.vendor_name
