-- Create accounts table for Chart of Accounts
CREATE TABLE IF NOT EXISTS accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL,
    account_number VARCHAR(20) NOT NULL,
    account_name VARCHAR(255) NOT NULL,
    account_type VARCHAR(50) NOT NULL, -- Asset, Liability, Equity, Income, Expense
    account_subtype VARCHAR(50), -- Current Asset, Fixed Asset, Current Liability, Long-term Liability, etc.
    parent_account_id UUID REFERENCES accounts(id),
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    is_system BOOLEAN DEFAULT false, -- true for default accounts that shouldn't be deleted
    balance DECIMAL(15, 2) DEFAULT 0.00,
    normal_balance VARCHAR(10) DEFAULT 'debit', -- 'debit' or 'credit'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),
    
    -- Ensure account numbers are unique per company
    UNIQUE(company_id, account_number)
);

-- Create index for faster lookups
CREATE INDEX idx_accounts_company_id ON accounts(company_id);
CREATE INDEX idx_accounts_type ON accounts(account_type);
CREATE INDEX idx_accounts_active ON accounts(is_active);
CREATE INDEX idx_accounts_parent ON accounts(parent_account_id);

-- Enable Row Level Security
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only see accounts for their company
CREATE POLICY "Users can view their company's accounts"
    ON accounts FOR SELECT
    USING (
        company_id IN (
            SELECT company_id FROM profiles WHERE id = auth.uid()
        )
    );

-- RLS Policy: Users can insert accounts for their company
CREATE POLICY "Users can create accounts for their company"
    ON accounts FOR INSERT
    WITH CHECK (
        company_id IN (
            SELECT company_id FROM profiles WHERE id = auth.uid()
        )
    );

-- RLS Policy: Users can update their company's accounts
CREATE POLICY "Users can update their company's accounts"
    ON accounts FOR UPDATE
    USING (
        company_id IN (
            SELECT company_id FROM profiles WHERE id = auth.uid()
        )
    );

-- RLS Policy: Users can delete their company's non-system accounts
CREATE POLICY "Users can delete their company's non-system accounts"
    ON accounts FOR DELETE
    USING (
        company_id IN (
            SELECT company_id FROM profiles WHERE id = auth.uid()
        )
        AND is_system = false
    );

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_accounts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
CREATE TRIGGER update_accounts_timestamp
    BEFORE UPDATE ON accounts
    FOR EACH ROW
    EXECUTE FUNCTION update_accounts_updated_at();

-- Insert default Chart of Accounts (will be associated with each new company)
-- Note: These will need company_id when actually created, this is just a template

COMMENT ON TABLE accounts IS 'Chart of Accounts - All financial accounts in double-entry bookkeeping system';
COMMENT ON COLUMN accounts.account_number IS 'Unique account number (e.g., 1000, 1010, 2000)';
COMMENT ON COLUMN accounts.account_type IS 'Main account type: Asset, Liability, Equity, Income, or Expense';
COMMENT ON COLUMN accounts.account_subtype IS 'Subtype for more specific categorization';
COMMENT ON COLUMN accounts.normal_balance IS 'Normal balance side: debit (Assets, Expenses) or credit (Liabilities, Equity, Income)';
COMMENT ON COLUMN accounts.is_system IS 'System accounts cannot be deleted, only archived';

-- Create a function to initialize default accounts for a company
CREATE OR REPLACE FUNCTION create_default_accounts(p_company_id UUID, p_user_id UUID)
RETURNS void AS $$
BEGIN
    -- ASSETS (1000-1999)
    INSERT INTO accounts (company_id, account_number, account_name, account_type, account_subtype, normal_balance, is_system, created_by) VALUES
    (p_company_id, '1000', 'Cash', 'Asset', 'Current Asset', 'debit', true, p_user_id),
    (p_company_id, '1010', 'Checking Account', 'Asset', 'Current Asset', 'debit', true, p_user_id),
    (p_company_id, '1020', 'Savings Account', 'Asset', 'Current Asset', 'debit', true, p_user_id),
    (p_company_id, '1100', 'Accounts Receivable', 'Asset', 'Current Asset', 'debit', true, p_user_id),
    (p_company_id, '1200', 'Inventory', 'Asset', 'Current Asset', 'debit', true, p_user_id),
    (p_company_id, '1300', 'Prepaid Expenses', 'Asset', 'Current Asset', 'debit', true, p_user_id),
    (p_company_id, '1500', 'Equipment', 'Asset', 'Fixed Asset', 'debit', true, p_user_id),
    (p_company_id, '1510', 'Vehicles', 'Asset', 'Fixed Asset', 'debit', true, p_user_id),
    (p_company_id, '1520', 'Tools', 'Asset', 'Fixed Asset', 'debit', true, p_user_id),
    (p_company_id, '1600', 'Accumulated Depreciation', 'Asset', 'Fixed Asset', 'credit', true, p_user_id),
    
    -- LIABILITIES (2000-2999)
    (p_company_id, '2000', 'Accounts Payable', 'Liability', 'Current Liability', 'credit', true, p_user_id),
    (p_company_id, '2100', 'Credit Cards Payable', 'Liability', 'Current Liability', 'credit', true, p_user_id),
    (p_company_id, '2200', 'Sales Tax Payable', 'Liability', 'Current Liability', 'credit', true, p_user_id),
    (p_company_id, '2300', 'Payroll Liabilities', 'Liability', 'Current Liability', 'credit', true, p_user_id),
    (p_company_id, '2500', 'Notes Payable', 'Liability', 'Long-term Liability', 'credit', true, p_user_id),
    (p_company_id, '2600', 'Loans Payable', 'Liability', 'Long-term Liability', 'credit', true, p_user_id),
    
    -- EQUITY (3000-3999)
    (p_company_id, '3000', 'Owner''s Equity', 'Equity', 'Owner Equity', 'credit', true, p_user_id),
    (p_company_id, '3100', 'Owner Draws', 'Equity', 'Owner Equity', 'debit', true, p_user_id),
    (p_company_id, '3900', 'Retained Earnings', 'Equity', 'Retained Earnings', 'credit', true, p_user_id),
    
    -- INCOME (4000-4999)
    (p_company_id, '4000', 'Service Revenue', 'Income', 'Operating Income', 'credit', true, p_user_id),
    (p_company_id, '4100', 'Material Sales', 'Income', 'Operating Income', 'credit', true, p_user_id),
    (p_company_id, '4200', 'Labor Revenue', 'Income', 'Operating Income', 'credit', true, p_user_id),
    (p_company_id, '4900', 'Other Income', 'Income', 'Other Income', 'credit', true, p_user_id),
    
    -- EXPENSES (5000-9999)
    (p_company_id, '5000', 'Cost of Goods Sold', 'Expense', 'Cost of Sales', 'debit', true, p_user_id),
    (p_company_id, '5100', 'Materials Expense', 'Expense', 'Cost of Sales', 'debit', true, p_user_id),
    (p_company_id, '5200', 'Subcontractor Expense', 'Expense', 'Cost of Sales', 'debit', true, p_user_id),
    (p_company_id, '6000', 'Labor Expense', 'Expense', 'Operating Expense', 'debit', true, p_user_id),
    (p_company_id, '6100', 'Payroll Taxes', 'Expense', 'Operating Expense', 'debit', true, p_user_id),
    (p_company_id, '6200', 'Employee Benefits', 'Expense', 'Operating Expense', 'debit', true, p_user_id),
    (p_company_id, '6500', 'Rent Expense', 'Expense', 'Operating Expense', 'debit', true, p_user_id),
    (p_company_id, '6600', 'Utilities', 'Expense', 'Operating Expense', 'debit', true, p_user_id),
    (p_company_id, '6700', 'Insurance', 'Expense', 'Operating Expense', 'debit', true, p_user_id),
    (p_company_id, '6800', 'Vehicle Expense', 'Expense', 'Operating Expense', 'debit', true, p_user_id),
    (p_company_id, '6810', 'Fuel', 'Expense', 'Operating Expense', 'debit', true, p_user_id),
    (p_company_id, '6820', 'Vehicle Maintenance', 'Expense', 'Operating Expense', 'debit', true, p_user_id),
    (p_company_id, '7000', 'Office Supplies', 'Expense', 'Operating Expense', 'debit', true, p_user_id),
    (p_company_id, '7100', 'Equipment Rental', 'Expense', 'Operating Expense', 'debit', true, p_user_id),
    (p_company_id, '7200', 'Tools Expense', 'Expense', 'Operating Expense', 'debit', true, p_user_id),
    (p_company_id, '7300', 'Permits and Licenses', 'Expense', 'Operating Expense', 'debit', true, p_user_id),
    (p_company_id, '7400', 'Marketing and Advertising', 'Expense', 'Operating Expense', 'debit', true, p_user_id),
    (p_company_id, '7500', 'Professional Fees', 'Expense', 'Operating Expense', 'debit', true, p_user_id),
    (p_company_id, '7600', 'Bank Fees', 'Expense', 'Operating Expense', 'debit', true, p_user_id),
    (p_company_id, '7700', 'Depreciation Expense', 'Expense', 'Operating Expense', 'debit', true, p_user_id),
    (p_company_id, '7800', 'Repairs and Maintenance', 'Expense', 'Operating Expense', 'debit', true, p_user_id),
    (p_company_id, '7900', 'Telephone and Internet', 'Expense', 'Operating Expense', 'debit', true, p_user_id),
    (p_company_id, '8000', 'Interest Expense', 'Expense', 'Other Expense', 'debit', true, p_user_id),
    (p_company_id, '9000', 'Miscellaneous Expense', 'Expense', 'Other Expense', 'debit', true, p_user_id);
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION create_default_accounts IS 'Creates standard Chart of Accounts for a new company';
