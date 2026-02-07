-- Create bank_accounts table
CREATE TABLE IF NOT EXISTS bank_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL,
    account_name VARCHAR(255) NOT NULL,
    account_number VARCHAR(50),
    bank_name VARCHAR(255),
    account_type VARCHAR(50) DEFAULT 'Checking', -- Checking, Savings, Credit Card, etc.
    routing_number VARCHAR(50),
    current_balance DECIMAL(15, 2) DEFAULT 0.00,
    opening_balance DECIMAL(15, 2) DEFAULT 0.00,
    opening_date DATE,
    last_reconciled_date DATE,
    last_reconciled_balance DECIMAL(15, 2),
    chart_account_id UUID REFERENCES accounts(id), -- Link to Chart of Accounts
    is_active BOOLEAN DEFAULT true,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id)
);

-- Create bank_transactions table
CREATE TABLE IF NOT EXISTS bank_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    bank_account_id UUID NOT NULL REFERENCES bank_accounts(id) ON DELETE CASCADE,
    transaction_date DATE NOT NULL,
    description TEXT NOT NULL,
    reference_number VARCHAR(100), -- Check number, transaction ID, etc.
    amount DECIMAL(15, 2) NOT NULL, -- Positive for deposits, negative for withdrawals
    transaction_type VARCHAR(50) NOT NULL, -- 'deposit', 'withdrawal', 'transfer', 'fee', 'interest'
    category VARCHAR(100),
    payee VARCHAR(255),
    is_cleared BOOLEAN DEFAULT false,
    is_reconciled BOOLEAN DEFAULT false,
    reconciliation_id UUID, -- Will link to reconciliations table in Phase 4
    matched_journal_entry_id UUID REFERENCES journal_entries(id),
    imported_date TIMESTAMP WITH TIME ZONE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id)
);

-- Create indexes for faster lookups
CREATE INDEX idx_bank_accounts_company_id ON bank_accounts(company_id);
CREATE INDEX idx_bank_accounts_active ON bank_accounts(is_active);
CREATE INDEX idx_bank_accounts_chart_account ON bank_accounts(chart_account_id);
CREATE INDEX idx_bank_transactions_account_id ON bank_transactions(bank_account_id);
CREATE INDEX idx_bank_transactions_date ON bank_transactions(transaction_date);
CREATE INDEX idx_bank_transactions_cleared ON bank_transactions(is_cleared);
CREATE INDEX idx_bank_transactions_reconciled ON bank_transactions(is_reconciled);
CREATE INDEX idx_bank_transactions_journal_entry ON bank_transactions(matched_journal_entry_id);

-- Enable Row Level Security
ALTER TABLE bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_transactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for bank_accounts
CREATE POLICY "Users can view their company's bank accounts"
    ON bank_accounts FOR SELECT
    USING (
        company_id IN (
            SELECT company_id FROM profiles WHERE id = auth.uid()
        )
    );

CREATE POLICY "Users can create bank accounts for their company"
    ON bank_accounts FOR INSERT
    WITH CHECK (
        company_id IN (
            SELECT company_id FROM profiles WHERE id = auth.uid()
        )
    );

CREATE POLICY "Users can update their company's bank accounts"
    ON bank_accounts FOR UPDATE
    USING (
        company_id IN (
            SELECT company_id FROM profiles WHERE id = auth.uid()
        )
    );

CREATE POLICY "Users can delete their company's bank accounts"
    ON bank_accounts FOR DELETE
    USING (
        company_id IN (
            SELECT company_id FROM profiles WHERE id = auth.uid()
        )
    );

-- RLS Policies for bank_transactions
CREATE POLICY "Users can view transactions for their company's bank accounts"
    ON bank_transactions FOR SELECT
    USING (
        bank_account_id IN (
            SELECT id FROM bank_accounts WHERE company_id IN (
                SELECT company_id FROM profiles WHERE id = auth.uid()
            )
        )
    );

CREATE POLICY "Users can create transactions for their company's bank accounts"
    ON bank_transactions FOR INSERT
    WITH CHECK (
        bank_account_id IN (
            SELECT id FROM bank_accounts WHERE company_id IN (
                SELECT company_id FROM profiles WHERE id = auth.uid()
            )
        )
    );

CREATE POLICY "Users can update transactions for their company's bank accounts"
    ON bank_transactions FOR UPDATE
    USING (
        bank_account_id IN (
            SELECT id FROM bank_accounts WHERE company_id IN (
                SELECT company_id FROM profiles WHERE id = auth.uid()
            )
        )
    );

CREATE POLICY "Users can delete unreconciled transactions for their company's bank accounts"
    ON bank_transactions FOR DELETE
    USING (
        bank_account_id IN (
            SELECT id FROM bank_accounts WHERE company_id IN (
                SELECT company_id FROM profiles WHERE id = auth.uid()
            )
        )
        AND is_reconciled = false
    );

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_bank_accounts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
CREATE TRIGGER update_bank_accounts_timestamp
    BEFORE UPDATE ON bank_accounts
    FOR EACH ROW
    EXECUTE FUNCTION update_bank_accounts_updated_at();

-- Function to update bank account balance when transactions are added/modified
CREATE OR REPLACE FUNCTION update_bank_account_balance()
RETURNS TRIGGER AS $$
DECLARE
    v_current_balance DECIMAL(15, 2);
BEGIN
    -- Calculate total balance from opening balance + all cleared transactions
    SELECT 
        COALESCE(ba.opening_balance, 0) + COALESCE(SUM(bt.amount), 0)
    INTO v_current_balance
    FROM bank_accounts ba
    LEFT JOIN bank_transactions bt ON bt.bank_account_id = ba.id AND bt.is_cleared = true
    WHERE ba.id = COALESCE(NEW.bank_account_id, OLD.bank_account_id)
    GROUP BY ba.id, ba.opening_balance;
    
    -- Update the bank account balance
    UPDATE bank_accounts
    SET current_balance = v_current_balance
    WHERE id = COALESCE(NEW.bank_account_id, OLD.bank_account_id);
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Trigger to update bank account balance after transaction changes
CREATE TRIGGER update_bank_balance_after_transaction_insert
    AFTER INSERT ON bank_transactions
    FOR EACH ROW
    EXECUTE FUNCTION update_bank_account_balance();

CREATE TRIGGER update_bank_balance_after_transaction_update
    AFTER UPDATE ON bank_transactions
    FOR EACH ROW
    WHEN (OLD.amount IS DISTINCT FROM NEW.amount OR OLD.is_cleared IS DISTINCT FROM NEW.is_cleared)
    EXECUTE FUNCTION update_bank_account_balance();

CREATE TRIGGER update_bank_balance_after_transaction_delete
    AFTER DELETE ON bank_transactions
    FOR EACH ROW
    EXECUTE FUNCTION update_bank_account_balance();

COMMENT ON TABLE bank_accounts IS 'Bank accounts for the company (checking, savings, credit cards)';
COMMENT ON TABLE bank_transactions IS 'Bank transactions for reconciliation and tracking';
COMMENT ON COLUMN bank_transactions.amount IS 'Positive for deposits/income, negative for withdrawals/expenses';
COMMENT ON COLUMN bank_transactions.is_cleared IS 'Transaction has cleared the bank';
COMMENT ON COLUMN bank_transactions.is_reconciled IS 'Transaction has been reconciled against bank statement';
COMMENT ON FUNCTION update_bank_account_balance IS 'Automatically updates bank account balance based on cleared transactions';
