-- Add income_account_id column to expenses table
-- This allows expenses to be recorded against income accounts (like "Other Income")

ALTER TABLE expenses
ADD COLUMN income_account_id UUID NULL REFERENCES accounts(id) ON DELETE SET NULL;

-- Create index for better query performance
CREATE INDEX idx_expenses_income_account_id ON expenses(income_account_id);
