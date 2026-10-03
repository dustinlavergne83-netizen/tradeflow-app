-- ============================================================================
-- Add bank_transactions.linked_bill_id
-- ============================================================================
-- Bank Transactions' matching engine checks expenses, invoices, and invoice
-- payments, but never bills — so a check/payment made against a Bill in the
-- Bills page could never show up as a match when the same transaction later
-- appeared on an imported/entered bank statement. This left paid bills with
-- no way to be recognized and cleared without creating a duplicate journal
-- entry.
--
-- linked_bill_id mirrors linked_expense_id / linked_invoice_id: once a bank
-- transaction is linked to a bill, clearing it just updates status — it does
-- NOT create a new journal entry, since createBillPaymentJournalEntry
-- already posted Dr Accounts Payable / Cr Bank when the bill was paid.
-- ============================================================================

ALTER TABLE bank_transactions ADD COLUMN IF NOT EXISTS linked_bill_id UUID REFERENCES bills(id) ON DELETE SET NULL;

COMMENT ON COLUMN bank_transactions.linked_bill_id IS 'The bill this bank transaction represents the payment for. When set, clearing this transaction does not create a new journal entry (the bill payment already created one via createBillPaymentJournalEntry).';
