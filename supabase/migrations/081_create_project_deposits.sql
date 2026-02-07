-- Create project_deposits table for tracking deposits received on projects
CREATE TABLE IF NOT EXISTS project_deposits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  deposit_amount DECIMAL(12, 2) NOT NULL,
  deposit_date DATE NOT NULL,
  bank_account_id UUID REFERENCES accounts(id),
  reference_notes TEXT,
  status VARCHAR(20) DEFAULT 'received', -- 'received', 'applied', 'cancelled'
  invoice_id UUID REFERENCES invoices(id), -- Link to invoice when applied
  applied_date TIMESTAMP,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_project_deposits_project_id ON project_deposits(project_id);
CREATE INDEX idx_project_deposits_status ON project_deposits(status);
CREATE INDEX idx_project_deposits_invoice_id ON project_deposits(invoice_id);

-- Add comment
COMMENT ON TABLE project_deposits IS 'Tracks deposits received on projects with optional bank account and journal entry tracking';

-- Enable RLS
ALTER TABLE project_deposits ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only see deposits for projects they created
CREATE POLICY project_deposits_user_isolation ON project_deposits
  FOR ALL USING (created_by = auth.uid());
