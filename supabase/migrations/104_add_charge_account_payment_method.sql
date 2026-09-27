-- ============================================================================
-- Add "Charge Account" payment method support to expenses
-- ============================================================================
-- Problem: when a purchase is made on a supplier charge/open account (e.g.
-- Teche Electric, Coburns Electric), it is NOT a cash/bank payment at the
-- time of purchase — it creates a liability that gets paid off later in a
-- lump sum. Recording it as a normal "cash" or "bank" expense incorrectly
-- credits Cash/Bank immediately, when no money actually left the account
-- yet. This caused the 2023 double-counting issue (purchase expensed AND
-- the later lump-sum payment also expensed).
--
-- Fix: add 'charge_account' as a valid payment_method, and a
-- liability_account_id column so the expense can credit a specific
-- supplier liability account (e.g. "2130 Teche Electric Account") instead
-- of Cash/Bank. The debit side (the expense account, e.g. Cost of Goods
-- Sold) is unchanged — only the credit side differs.
-- ============================================================================

-- Relax the payment_method CHECK constraint to allow 'charge_account'
ALTER TABLE expenses DROP CONSTRAINT IF EXISTS expenses_payment_method_check;
ALTER TABLE expenses ADD CONSTRAINT expenses_payment_method_check
  CHECK (payment_method = ANY (ARRAY['cash'::text, 'check'::text, 'credit_card'::text, 'debit_card'::text, 'ach'::text, 'charge_account'::text, 'other'::text, NULL::text]));

-- New column: which liability account this charge purchase is owed on
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS liability_account_id UUID REFERENCES accounts(id) ON DELETE SET NULL;

COMMENT ON COLUMN expenses.liability_account_id IS 'When payment_method = charge_account, the Liability-type Chart of Accounts entry that this purchase is owed on (e.g. a supplier open account). The expense journal entry credits this account instead of Cash/Bank.';
