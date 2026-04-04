-- ============================================================
-- CREATE invoice_payments TABLE
-- Stores individual payment records for each invoice
-- Run this ONCE in Supabase SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS invoice_payments (
  id                UUID          DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_id        UUID          NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  company_id        UUID          NOT NULL,
  payment_date      DATE          NOT NULL,
  amount            NUMERIC(12,2) NOT NULL,
  payment_method    TEXT,
  processing_fee    NUMERIC(12,2) DEFAULT 0,
  net_amount        NUMERIC(12,2),          -- amount minus processing_fee
  notes             TEXT,
  bank_account_id   UUID          REFERENCES bank_accounts(id) ON DELETE SET NULL,
  journal_entry_id  UUID          REFERENCES journal_entries(id) ON DELETE SET NULL,
  created_by        UUID          NOT NULL,
  created_at        TIMESTAMPTZ   DEFAULT NOW()
);

-- Index for fast lookup by invoice
CREATE INDEX IF NOT EXISTS idx_invoice_payments_invoice_id ON invoice_payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_payments_company_id ON invoice_payments(company_id);

-- Enable RLS
ALTER TABLE invoice_payments ENABLE ROW LEVEL SECURITY;

-- RLS Policy: users can only see their own company's payments
CREATE POLICY "invoice_payments_company_isolation"
  ON invoice_payments
  FOR ALL
  USING (company_id = auth.uid())
  WITH CHECK (company_id = auth.uid());

-- Verify the table was created
SELECT 'invoice_payments table created successfully!' AS status;
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'invoice_payments'
ORDER BY ordinal_position;
