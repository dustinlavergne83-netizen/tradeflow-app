-- Create vendor_contacts table for multiple contacts per vendor
CREATE TABLE IF NOT EXISTS vendor_contacts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  title TEXT,
  email TEXT,
  phone TEXT,
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookup by vendor
CREATE INDEX IF NOT EXISTS idx_vendor_contacts_vendor_id ON vendor_contacts(vendor_id);

-- Enable RLS
ALTER TABLE vendor_contacts ENABLE ROW LEVEL SECURITY;

-- Policy: users can manage contacts for their company's vendors
CREATE POLICY "vendor_contacts_policy" ON vendor_contacts
  USING (
    vendor_id IN (
      SELECT id FROM vendors WHERE company_id = auth.uid()
    )
  );
