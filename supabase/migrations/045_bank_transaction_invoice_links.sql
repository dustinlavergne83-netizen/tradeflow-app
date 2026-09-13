-- Allow a single bank transaction (e.g. a lump-sum deposit) to be linked to
-- MULTIPLE invoices, in addition to the existing single linked_invoice_id
-- column on bank_transactions (kept for backward compatibility — it will be
-- set to the first invoice in a multi-link for any code that still reads it).

CREATE TABLE IF NOT EXISTS bank_transaction_invoices (
  id                    UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_transaction_id   UUID          NOT NULL REFERENCES bank_transactions(id) ON DELETE CASCADE,
  invoice_id            UUID          NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  amount_applied        NUMERIC(12,2) NOT NULL,
  company_id            UUID          NOT NULL,
  created_at            TIMESTAMPTZ   DEFAULT NOW(),
  created_by            UUID          REFERENCES auth.users(id),
  UNIQUE (bank_transaction_id, invoice_id)
);

CREATE INDEX IF NOT EXISTS idx_bti_transaction ON bank_transaction_invoices(bank_transaction_id);
CREATE INDEX IF NOT EXISTS idx_bti_invoice     ON bank_transaction_invoices(invoice_id);
CREATE INDEX IF NOT EXISTS idx_bti_company     ON bank_transaction_invoices(company_id);

ALTER TABLE bank_transaction_invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bank_transaction_invoices_company_isolation"
  ON bank_transaction_invoices
  FOR ALL
  USING (company_id = auth.uid())
  WITH CHECK (company_id = auth.uid());

COMMENT ON TABLE bank_transaction_invoices IS
  'Join table allowing one bank transaction (deposit) to be linked to multiple invoices, e.g. a lump-sum customer payment covering several invoices at once. bank_transactions.linked_invoice_id is still populated (with the first invoice) for backward compatibility with existing single-invoice reporting/reconciliation code.';
