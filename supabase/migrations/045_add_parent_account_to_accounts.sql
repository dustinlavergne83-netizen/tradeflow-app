-- Add parent account support for subaccounts
-- This allows creating hierarchical accounts like:
-- 6500 Insurance (parent)
--   6510 Vehicle Insurance (subaccount)
--   6520 Business Insurance (subaccount)
--   6530 Worker's Comp (subaccount)

ALTER TABLE accounts
ADD COLUMN parent_account_id UUID REFERENCES accounts(id) ON DELETE SET NULL;

-- Add index for performance
CREATE INDEX idx_accounts_parent_account_id ON accounts(parent_account_id);

-- Add comments
COMMENT ON COLUMN accounts.parent_account_id IS 'Reference to parent account for creating subaccounts/hierarchical chart of accounts';
