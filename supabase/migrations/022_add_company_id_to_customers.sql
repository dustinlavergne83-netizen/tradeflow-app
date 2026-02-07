-- Add company_id column to existing customers table
ALTER TABLE customers ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Create index
CREATE INDEX IF NOT EXISTS idx_customers_company ON customers(company_id);

-- Update RLS policies to use company_id
DROP POLICY IF EXISTS "Users can view their own customers" ON customers;
DROP POLICY IF EXISTS "Users can insert their own customers" ON customers;
DROP POLICY IF EXISTS "Users can update their own customers" ON customers;
DROP POLICY IF EXISTS "Users can delete their own customers" ON customers;

CREATE POLICY "Users can view their own customers"
  ON customers FOR SELECT
  USING (auth.uid() = company_id);

CREATE POLICY "Users can insert their own customers"
  ON customers FOR INSERT
  WITH CHECK (auth.uid() = company_id);

CREATE POLICY "Users can update their own customers"
  ON customers FOR UPDATE
  USING (auth.uid() = company_id);

CREATE POLICY "Users can delete their own customers"
  ON customers FOR DELETE
  USING (auth.uid() = company_id);
