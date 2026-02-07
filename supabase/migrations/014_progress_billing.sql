-- ====================================
-- PROGRESS BILLING SUPPORT
-- ====================================
-- Track billing history for estimate items to enable progress invoicing
-- and prevent over-billing

-- Create billing history table
CREATE TABLE IF NOT EXISTS estimate_item_billing_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  estimate_item_id UUID REFERENCES estimate_items(id) ON DELETE CASCADE,
  invoice_id UUID REFERENCES invoices(id) ON DELETE CASCADE,
  original_amount DECIMAL(12,2) NOT NULL,
  billed_amount DECIMAL(12,2) NOT NULL,
  billing_type TEXT NOT NULL CHECK (billing_type IN ('percentage', 'fixed')),
  billing_value DECIMAL(10,2) NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_billing_history_estimate_item 
  ON estimate_item_billing_history(estimate_item_id);
  
CREATE INDEX IF NOT EXISTS idx_billing_history_invoice 
  ON estimate_item_billing_history(invoice_id);

-- Enable Row Level Security
ALTER TABLE estimate_item_billing_history ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view their own billing history
CREATE POLICY "Users can view their billing history"
  ON estimate_item_billing_history FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM estimate_items 
    JOIN estimates ON estimates.id = estimate_items.estimate_id 
    WHERE estimate_items.id = estimate_item_billing_history.estimate_item_id 
    AND estimates.company_id = auth.uid()
  ));

-- RLS Policy: Users can insert their own billing history
CREATE POLICY "Users can insert their billing history"
  ON estimate_item_billing_history FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM estimate_items 
    JOIN estimates ON estimates.id = estimate_items.estimate_id 
    WHERE estimate_items.id = estimate_item_billing_history.estimate_item_id 
    AND estimates.company_id = auth.uid()
  ));

-- RLS Policy: Users can update their own billing history
CREATE POLICY "Users can update their billing history"
  ON estimate_item_billing_history FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM estimate_items 
    JOIN estimates ON estimates.id = estimate_items.estimate_id 
    WHERE estimate_items.id = estimate_item_billing_history.estimate_item_id 
    AND estimates.company_id = auth.uid()
  ));

-- RLS Policy: Users can delete their own billing history
CREATE POLICY "Users can delete their billing history"
  ON estimate_item_billing_history FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM estimate_items 
    JOIN estimates ON estimates.id = estimate_items.estimate_id 
    WHERE estimate_items.id = estimate_item_billing_history.estimate_item_id 
    AND estimates.company_id = auth.uid()
  ));
