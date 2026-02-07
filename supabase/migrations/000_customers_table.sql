-- Create customers table if it doesn't exist
CREATE TABLE IF NOT EXISTS customers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  contact TEXT,
  address TEXT,
  email TEXT,
  phone TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add name column if it doesn't exist (for existing tables)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='customers' AND column_name='name') THEN
    ALTER TABLE customers ADD COLUMN name TEXT NOT NULL DEFAULT '';
  END IF;
END $$;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_customers_company ON customers(company_id);

-- Only create name index if column exists
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_name='customers' AND column_name='name') THEN
    CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name);
  END IF;
END $$;

-- Enable RLS
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

-- RLS Policies
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
