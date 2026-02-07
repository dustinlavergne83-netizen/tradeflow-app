-- Create vendors table
CREATE TABLE IF NOT EXISTS vendors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    vendor_name TEXT NOT NULL,
    contact_person TEXT,
    address TEXT,
    email TEXT,
    phone TEXT,
    website TEXT,
    account_number TEXT,
    payment_terms TEXT DEFAULT '30',
    notes TEXT,
    balance DECIMAL(12, 2) DEFAULT 0,
    archived BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_vendors_company ON vendors(company_id);
CREATE INDEX IF NOT EXISTS idx_vendors_archived ON vendors(archived);
CREATE INDEX IF NOT EXISTS idx_vendors_name ON vendors(vendor_name);

-- Enable RLS
ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Users can view their own vendors" ON vendors;
DROP POLICY IF EXISTS "Users can insert their own vendors" ON vendors;
DROP POLICY IF EXISTS "Users can update their own vendors" ON vendors;
DROP POLICY IF EXISTS "Users can delete their own vendors" ON vendors;

CREATE POLICY "Users can view their own vendors"
  ON vendors FOR SELECT
  USING (auth.uid() = company_id);

CREATE POLICY "Users can insert their own vendors"
  ON vendors FOR INSERT
  WITH CHECK (auth.uid() = company_id);

CREATE POLICY "Users can update their own vendors"
  ON vendors FOR UPDATE
  USING (auth.uid() = company_id);

CREATE POLICY "Users can delete their own vendors"
  ON vendors FOR DELETE
  USING (auth.uid() = company_id);
