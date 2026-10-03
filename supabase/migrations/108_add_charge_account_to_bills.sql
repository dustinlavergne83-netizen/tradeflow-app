-- ============================================================================
-- Add bills.charge_account_id — the vendor's charge/open account, when the
-- bill is for a vendor that has one (e.g. "2130 Teche Electric Account").
-- ============================================================================
-- Accounting model for charge-account vendors (e.g. Teche, Elliott, Coburns):
--
--   1. Purchase on the charge account (Expenses page):
--        Dr Expense (COGS/etc.)          Cr Vendor Charge Account
--      This is the only place the expense is recognized.
--
--   2. Bill arrives (Bills page):
--        Dr Vendor Charge Account        Cr Accounts Payable
--      No expense line here — the purchase was already expensed in step 1.
--      This just moves the running charge-account balance into a formal
--      payable.
--
--   3. Bill is paid (Bills page):
--        Dr Accounts Payable             Cr Bank
--
-- For vendors WITHOUT a charge account, the bill is the first and only
-- record of the purchase:
--        Dr Expense (bills.expense_account_id)   Cr Accounts Payable
--
-- bills.liability_account_id is always Accounts Payable (the credit side of
-- the bill entry / debit side of the payment entry).
-- bills.charge_account_id is the debit side of the bill entry when the
-- vendor has a dedicated charge account (null otherwise).
-- ============================================================================

ALTER TABLE bills ADD COLUMN IF NOT EXISTS charge_account_id UUID REFERENCES accounts(id) ON DELETE SET NULL;

COMMENT ON COLUMN bills.charge_account_id IS 'Vendor charge/open account (e.g. 2130 Teche Electric Account) debited when this bill is entered, if the vendor has one. Null for vendors without a dedicated charge account. The expense was already recognized when the purchase was made on the charge account, so this bill does not post a second expense line.';
COMMENT ON COLUMN bills.liability_account_id IS 'Always Accounts Payable (2000) for bills. Credited when the bill is entered, debited when the bill is paid.';
