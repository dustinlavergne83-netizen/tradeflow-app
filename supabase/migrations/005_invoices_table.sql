-- ====================================
-- INVOICES TABLE
-- ====================================

CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number TEXT,
  project_name TEXT NOT NULL,
  customer_name TEXT,
  invoice_date DATE DEFAULT CURRENT_DATE,
  due_date DATE,
  subtotal DECIMAL(12,2) DEFAULT 0,
  tax_rate DECIMAL(5,2) DEFAULT 0,
  tax_amount DECIMAL(12,2) DEFAULT 0,
  total DECIMAL(12,2) DEFAULT 0,
  amount_paid DECIMAL(12,2) DEFAULT 0,
  balance_due DECIMAL(12,2) DEFAULT 0,
  status TEXT DEFAULT 'draft', -- draft, sent, paid, overdue, partial
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Invoice line items table
CREATE TABLE IF NOT EXISTS invoice_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID REFERENCES invoices(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  quantity DECIMAL(10,2) DEFAULT 1,
  unit_price DECIMAL(10,2) DEFAULT 0,
  total DECIMAL(12,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_invoices_project_name ON invoices(project_name);
CREATE INDEX IF NOT EXISTS idx_invoices_created_by ON invoices(created_by);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice_id ON invoice_items(invoice_id);

-- Enable RLS
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies for invoices
CREATE POLICY "Users can view their own invoices"
  ON invoices FOR SELECT
  USING (auth.uid() = created_by);

CREATE POLICY "Users can insert their own invoices"
  ON invoices FOR INSERT
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update their own invoices"
  ON invoices FOR UPDATE
  USING (auth.uid() = created_by);

CREATE POLICY "Users can delete their own invoices"
  ON invoices FOR DELETE
  USING (auth.uid() = created_by);

-- RLS Policies for invoice_items
CREATE POLICY "Users can view their invoice items"
  ON invoice_items FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM invoices 
    WHERE invoices.id = invoice_items.invoice_id 
    AND invoices.created_by = auth.uid()
  ));

CREATE POLICY "Users can insert their invoice items"
  ON invoice_items FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM invoices 
    WHERE invoices.id = invoice_items.invoice_id 
    AND invoices.created_by = auth.uid()
  ));

CREATE POLICY "Users can update their invoice items"
  ON invoice_items FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM invoices 
    WHERE invoices.id = invoice_items.invoice_id 
    AND invoices.created_by = auth.uid()
  ));

CREATE POLICY "Users can delete their invoice items"
  ON invoice_items FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM invoices 
    WHERE invoices.id = invoice_items.invoice_id 
    AND invoices.created_by = auth.uid()
  ));

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_invoices_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
CREATE TRIGGER invoices_update_timestamp
BEFORE UPDATE ON invoices
FOR EACH ROW
EXECUTE FUNCTION update_invoices_updated_at();
