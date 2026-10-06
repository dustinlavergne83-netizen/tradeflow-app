-- Adds a flag distinguishing bank_transactions.linked_expense_id values that
-- were auto-created by the "Record to Books?" clear-time prompt (see
-- src/pages/BankTransactions.jsx createExpenseFromTransaction) from ones the
-- user manually linked to an existing expense via the Matches modal
-- (handleLinkExpense). Both set linked_expense_id, but only auto-created
-- expenses should be deleted when the transaction is later un-cleared —
-- manually-linked pre-existing expenses must never be silently destroyed.
ALTER TABLE public.bank_transactions
  ADD COLUMN IF NOT EXISTS auto_created_expense boolean DEFAULT false;
