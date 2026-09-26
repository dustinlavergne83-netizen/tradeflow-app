-- ═══════════════════════════════════════════════════════════════════════
--  Bank Transfer support for bank_transactions
--
--  Problem: transaction_type = 'transfer' already existed as a dropdown
--  option but nothing branched on it — clearing a transfer fell through
--  to the Expense/Income auto-fallback in BankTransactions.jsx, so moving
--  money between your own accounts was double-counted on the P&L
--  (expense on the way out, income on the way in).
--
--  Fix: a transfer needs to know WHICH bank account the money moved
--  to/from (transfer_account_id), and the two matching sides of the same
--  transfer need to be linked (transfer_pair_id) so only ONE journal
--  entry (asset-to-asset, zero P&L impact) is ever created for the pair.
-- ═══════════════════════════════════════════════════════════════════════

ALTER TABLE bank_transactions
  ADD COLUMN IF NOT EXISTS transfer_account_id UUID REFERENCES bank_accounts(id),
  ADD COLUMN IF NOT EXISTS transfer_pair_id UUID REFERENCES bank_transactions(id);

CREATE INDEX IF NOT EXISTS idx_bank_transactions_transfer_account
  ON bank_transactions(transfer_account_id);
CREATE INDEX IF NOT EXISTS idx_bank_transactions_transfer_pair
  ON bank_transactions(transfer_pair_id);

COMMENT ON COLUMN bank_transactions.transfer_account_id IS
  'For transaction_type = transfer: the OTHER bank account this money moved to/from. Used instead of category (Chart of Accounts) so transfers never post to Expense/Income.';
COMMENT ON COLUMN bank_transactions.transfer_pair_id IS
  'Links the two sides of the same transfer (withdrawal on source account, deposit on destination account) so only one journal entry is created for the pair, preventing double-counting.';
