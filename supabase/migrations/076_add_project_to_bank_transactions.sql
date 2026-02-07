-- Add project_id field to bank_transactions table
ALTER TABLE bank_transactions
ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE SET NULL;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_bank_transactions_project ON bank_transactions(project_id);

-- Add comment
COMMENT ON COLUMN bank_transactions.project_id IS 'Links this transaction to a specific project for tracking project-specific expenses and income';
