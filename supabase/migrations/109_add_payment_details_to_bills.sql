-- ============================================================================
-- Add payment method + reference/check number to bills
-- ============================================================================
-- The Pay Bill modal only captured which bank account paid a bill. Add the
-- ability to record how it was paid (check, ACH, debit card, etc.) and a
-- reference number (check #, transaction ID) for reconciliation, matching
-- the conventions already used by expenses.payment_method and
-- checks.reference_number.
-- ============================================================================

ALTER TABLE bills ADD COLUMN IF NOT EXISTS payment_method VARCHAR(30);
ALTER TABLE bills ADD COLUMN IF NOT EXISTS payment_reference VARCHAR(100);

COMMENT ON COLUMN bills.payment_method IS 'How the bill was paid: check, ach, debit_card, credit_card, cash, other. Set when the bill is marked paid.';
COMMENT ON COLUMN bills.payment_reference IS 'Check number or other payment reference/transaction ID, for reconciliation. Set when the bill is marked paid.';
