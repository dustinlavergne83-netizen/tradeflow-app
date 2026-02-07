-- ====================================
-- ADD BANK ACCOUNT TRACKING TO EXPENSES AND INVOICES
-- Migration 029
-- ====================================

-- Add bank_account_id to expenses table
-- This tracks which bank account an expense was paid from
ALTER TABLE expenses
ADD COLUMN bank_account_id UUID REFERENCES bank_accounts(id) ON DELETE SET NULL;

-- Add index for faster lookups
CREATE INDEX idx_expenses_bank_account_id ON expenses(bank_account_id);

-- Add comment
COMMENT ON COLUMN expenses.bank_account_id IS 'Which bank account this expense was paid from';

-- Add bank_account_id to invoices table  
-- This tracks which bank account a payment was deposited into
ALTER TABLE invoices
ADD COLUMN bank_account_id UUID REFERENCES bank_accounts(id) ON DELETE SET NULL;

-- Add index for faster lookups
CREATE INDEX idx_invoices_bank_account_id ON invoices(bank_account_id);

-- Add comment
COMMENT ON COLUMN invoices.bank_account_id IS 'Which bank account the payment was deposited into';

-- Note: We're using ON DELETE SET NULL so that if a bank account is deleted,
-- the historical expenses/invoices remain but the bank account reference is cleared
