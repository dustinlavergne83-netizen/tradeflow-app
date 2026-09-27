-- ═══════════════════════════════════════════════════════════════════════
--  Auto-created transfer counterpart flag
--
--  When clearing a transfer whose destination account has no matching
--  transaction yet (e.g. you haven't uploaded that account's statement),
--  TradeFlow creates a mirror transaction on the destination account so
--  the transfer can be fully recorded and journal-entried immediately.
--
--  That auto-created row needs to be told apart from a real imported
--  transaction, so that later — when you DO upload the destination
--  account's real statement — the importer can find it and UPDATE it in
--  place instead of inserting a duplicate. Without this flag, every
--  auto-created transfer would double up the moment its real statement
--  is imported, inflating both accounts' balances.
-- ═══════════════════════════════════════════════════════════════════════

ALTER TABLE bank_transactions
  ADD COLUMN IF NOT EXISTS auto_created BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_bank_transactions_auto_created
  ON bank_transactions(bank_account_id, auto_created)
  WHERE auto_created = true;

COMMENT ON COLUMN bank_transactions.auto_created IS
  'True when this row was auto-created as the counterpart of a transfer cleared on another account, rather than imported from that account''s own statement. Cleared/merged into the real transaction when that account''s statement is later imported.';
