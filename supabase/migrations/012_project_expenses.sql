-- Create project_expenses table with accounting integration
CREATE TABLE IF NOT EXISTS project_expenses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  
  -- Expense Details
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  description TEXT NOT NULL,
  category TEXT, -- 'material', 'equipment', 'subcontractor', 'labor', 'other'
  vendor TEXT,
  amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  receipt_url TEXT,
  notes TEXT,
  expense_number TEXT, -- Receipt/invoice number for tracking
  
  -- Accounting Fields
  paid_status TEXT DEFAULT 'unpaid', -- 'unpaid', 'paid', 'pending'
  payment_date DATE,
  payment_method TEXT, -- 'cash', 'check', 'credit_card', 'ach', 'account'
  check_number TEXT,
  
  -- Billing Fields
  billable BOOLEAN DEFAULT true, -- Can this be billed to customer?
  billed BOOLEAN DEFAULT false, -- Has it been billed yet?
  markup_percent DECIMAL(5,2) DEFAULT 0, -- Markup % if billing to customer
  
  -- Audit Fields
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for faster lookups
CREATE INDEX idx_project_expenses_project_id ON project_expenses(project_id);
CREATE INDEX idx_project_expenses_date ON project_expenses(expense_date);
CREATE INDEX idx_project_expenses_category ON project_expenses(category);
CREATE INDEX idx_project_expenses_vendor ON project_expenses(vendor);
CREATE INDEX idx_project_expenses_paid_status ON project_expenses(paid_status);

-- Add RLS policies
ALTER TABLE project_expenses ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view expenses for their own projects
CREATE POLICY "Users can view expenses for their projects"
  ON project_expenses
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM projects 
      WHERE projects.id = project_expenses.project_id 
      AND projects.created_by = auth.uid()
    )
  );

-- Policy: Users can insert expenses for their own projects
CREATE POLICY "Users can insert expenses for their projects"
  ON project_expenses
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects 
      WHERE projects.id = project_expenses.project_id 
      AND projects.created_by = auth.uid()
    )
  );

-- Policy: Users can update expenses for their own projects
CREATE POLICY "Users can update expenses for their projects"
  ON project_expenses
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM projects 
      WHERE projects.id = project_expenses.project_id 
      AND projects.created_by = auth.uid()
    )
  );

-- Policy: Users can delete expenses for their own projects
CREATE POLICY "Users can delete expenses for their projects"
  ON project_expenses
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM projects 
      WHERE projects.id = project_expenses.project_id 
      AND projects.created_by = auth.uid()
    )
  );

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_project_expenses_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
CREATE TRIGGER project_expenses_update_timestamp
BEFORE UPDATE ON project_expenses
FOR EACH ROW
EXECUTE FUNCTION update_project_expenses_updated_at();
