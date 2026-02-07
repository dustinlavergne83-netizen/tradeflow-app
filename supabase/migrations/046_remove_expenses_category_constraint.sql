-- Remove the check constraint on expenses.category so it can accept any account name
-- This allows using actual expense account names from chart of accounts

ALTER TABLE expenses DROP CONSTRAINT IF EXISTS expenses_category_check;

-- The category column can now hold any expense account name from the chart of accounts
COMMENT ON COLUMN expenses.category IS 'Expense account name from chart of accounts';
