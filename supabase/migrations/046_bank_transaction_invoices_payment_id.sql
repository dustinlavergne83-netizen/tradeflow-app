-- Multi-invoice deposit matching needs to operate on individual payment
-- records (invoice_payments), not whole invoices — processing fees live on
-- the payment, not the invoice, and one invoice can have several payments.
-- Add a nullable invoice_payment_id so a specific payment can be recorded,
-- and relax the old (bank_transaction_id, invoice_id) uniqueness so an
-- invoice can appear more than once (e.g. two separate payments on the
-- same invoice applied to the same deposit).

ALTER TABLE bank_transaction_invoices
  ADD COLUMN IF NOT EXISTS invoice_payment_id UUID REFERENCES invoice_payments(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_bti_invoice_payment ON bank_transaction_invoices(invoice_payment_id);

ALTER TABLE bank_transaction_invoices
  DROP CONSTRAINT IF EXISTS bank_transaction_invoices_bank_transaction_id_invoice_id_key;

-- New uniqueness: a given payment (or, for invoices with no payment record,
-- a given invoice) can only be applied once per transaction.
CREATE UNIQUE INDEX IF NOT EXISTS bank_transaction_invoices_unique_payment
  ON bank_transaction_invoices (bank_transaction_id, invoice_id, COALESCE(invoice_payment_id, '00000000-0000-0000-0000-000000000000'));

COMMENT ON COLUMN bank_transaction_invoices.invoice_payment_id IS
  'The specific invoice_payments row this line represents, when the invoice has payment records. NULL for invoices with no payment history (matched on invoice total instead).';
