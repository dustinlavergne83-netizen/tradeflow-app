-- ====================================
-- PROGRESS BILLING - RUN THIS IN SUPABASE DASHBOARD
-- ====================================
-- INSTRUCTIONS:
-- 1. Go to your Supabase project dashboard
-- 2. Click "SQL Editor" in the left sidebar
-- 3. Click "New Query"
-- 4. Copy and paste THIS ENTIRE FILE
-- 5. Click "Run" or press Ctrl+Enter
-- 6. You should see "Success. No rows returned"
-- 7. Done! Progress billing is ready to use!
-- ====================================

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

-- ====================================
-- ✅ ALL DONE! 
-- If you see no errors, progress billing is ready!
-- Go to a project → click "📊 Progress Invoice"
-- ====================================
