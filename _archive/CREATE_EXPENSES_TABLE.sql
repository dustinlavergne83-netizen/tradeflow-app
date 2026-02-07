-- ============================================
-- RUN THIS IN SUPABASE DASHBOARD SQL EDITOR
-- ============================================
-- Create Expenses Tracking System

-- Create expenses table
CREATE TABLE IF NOT EXISTS expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID,
  
  -- Expense details
  expense_date DATE NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  category TEXT NOT NULL,
  vendor TEXT,
  description TEXT,
  payment_method TEXT,
  account TEXT,
  
  -- Optional project link
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  project_name TEXT,
  
  -- Receipt tracking
  receipt_url TEXT,
  receipt_notes TEXT,
  
  -- Tax info
  tax_deductible BOOLEAN DEFAULT true,
  
  -- Status
  status TEXT DEFAULT 'pending',
  
  CONSTRAINT expenses_category_check 
    CHECK (category IN ('materials', 'labor', 'fuel', 'equipment', 'tools', 'permits', 'insurance', 'office', 'vehicle', 'utilities', 'marketing', 'subcontractor', 'other')),
  
  CONSTRAINT expenses_payment_method_check 
    CHECK (payment_method IN ('cash', 'check', 'credit_card', 'debit_card', 'ach', 'other', NULL)),
    
  CONSTRAINT expenses_status_check 
    CHECK (status IN ('pending', 'approved', 'reimbursed'))
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_expenses_created_by ON expenses(created_by);
CREATE INDEX IF NOT EXISTS idx_expenses_company_id ON expenses(company_id);
CREATE INDEX IF NOT EXISTS idx_expenses_project_id ON expenses(project_id);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(expense_date);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category);
CREATE INDEX IF NOT EXISTS idx_expenses_status ON expenses(status);

-- Enable RLS
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view own expenses"
  ON expenses FOR SELECT
  USING (auth.uid() = created_by);

CREATE POLICY "Users can insert own expenses"
  ON expenses FOR INSERT
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update own expenses"
  ON expenses FOR UPDATE
  USING (auth.uid() = created_by);

CREATE POLICY "Users can delete own expenses"
  ON expenses FOR DELETE
  USING (auth.uid() = created_by);

-- Done! Expense tracking is ready!
