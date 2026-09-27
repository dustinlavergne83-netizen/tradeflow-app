-- ═══════════════════════════════════════════════════════════════════════
--  Bank Statements — private storage bucket + tracking table for the
--  original bank statement documents (PDFs/images) for each bank account,
--  kept in the database for audits, disputes, or CPA requests.
--
--  Convention: follows the existing `receipts` bucket (private,
--  admin/supervisor-only via employees.role), not the public
--  `project-photos` bucket — statements contain full account numbers and
--  every transaction, so access is need-to-know.
--
--  Folder structure inside the bucket:
--    bank-statements/{bank_account_id}/{year}/{filename}
--  Uses the bank account's UUID (not its name) so renaming an account
--  later never orphans its files.
-- ═══════════════════════════════════════════════════════════════════════

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'bank-statements',
  'bank-statements',
  false,
  52428800, -- 50MB — scanned multi-page PDFs get large
  ARRAY['application/pdf', 'image/jpeg', 'image/jpg', 'image/png', 'text/csv']
)
ON CONFLICT (id) DO NOTHING;

-- Tracking table — searchable metadata for each uploaded statement,
-- so you can find "the March 2023 Operating 5400 statement" instead of
-- hunting through a flat file list.
CREATE TABLE IF NOT EXISTS bank_statements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL,
    bank_account_id UUID NOT NULL REFERENCES bank_accounts(id) ON DELETE CASCADE,
    statement_period_start DATE,
    statement_period_end DATE,
    file_path TEXT NOT NULL, -- path inside the bank-statements bucket
    file_name TEXT NOT NULL,
    file_size INTEGER,
    mime_type TEXT,
    beginning_balance DECIMAL(15, 2),
    ending_balance DECIMAL(15, 2),
    notes TEXT,
    uploaded_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bank_statements_company_id ON bank_statements(company_id);
CREATE INDEX IF NOT EXISTS idx_bank_statements_bank_account_id ON bank_statements(bank_account_id);
CREATE INDEX IF NOT EXISTS idx_bank_statements_period ON bank_statements(statement_period_start, statement_period_end);

ALTER TABLE bank_statements ENABLE ROW LEVEL SECURITY;

-- RLS — company_id = auth.uid(), matching bank_accounts/vendors convention
DROP POLICY IF EXISTS "Users can view their own bank statements" ON bank_statements;
DROP POLICY IF EXISTS "Users can insert their own bank statements" ON bank_statements;
DROP POLICY IF EXISTS "Users can update their own bank statements" ON bank_statements;
DROP POLICY IF EXISTS "Users can delete their own bank statements" ON bank_statements;

CREATE POLICY "Users can view their own bank statements"
    ON bank_statements FOR SELECT
    USING (auth.uid() = company_id);

CREATE POLICY "Users can insert their own bank statements"
    ON bank_statements FOR INSERT
    WITH CHECK (auth.uid() = company_id);

CREATE POLICY "Users can update their own bank statements"
    ON bank_statements FOR UPDATE
    USING (auth.uid() = company_id);

CREATE POLICY "Users can delete their own bank statements"
    ON bank_statements FOR DELETE
    USING (auth.uid() = company_id);

COMMENT ON TABLE bank_statements IS 'Metadata for original bank statement documents uploaded to the bank-statements storage bucket, kept for audits/disputes/CPA requests.';
COMMENT ON COLUMN bank_statements.file_path IS 'Path inside the bank-statements bucket: {bank_account_id}/{year}/{filename}';

-- Storage RLS — matches the existing `receipts` bucket pattern exactly
-- (admin/supervisor only, via employees.role), since statements contain
-- full account numbers and every transaction on the account.
DROP POLICY IF EXISTS "Admins and supervisors can read bank statements" ON storage.objects;
DROP POLICY IF EXISTS "Admins and supervisors can upload bank statements" ON storage.objects;
DROP POLICY IF EXISTS "Admins and supervisors can delete bank statements" ON storage.objects;

CREATE POLICY "Admins and supervisors can read bank statements"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'bank-statements'
    AND EXISTS (
      SELECT 1 FROM employees
      WHERE employees.user_id = auth.uid()
      AND (employees.role = 'admin' OR employees.role = 'supervisor')
    )
  );

CREATE POLICY "Admins and supervisors can upload bank statements"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'bank-statements'
    AND EXISTS (
      SELECT 1 FROM employees
      WHERE employees.user_id = auth.uid()
      AND (employees.role = 'admin' OR employees.role = 'supervisor')
    )
  );

CREATE POLICY "Admins and supervisors can delete bank statements"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'bank-statements'
    AND EXISTS (
      SELECT 1 FROM employees
      WHERE employees.user_id = auth.uid()
      AND (employees.role = 'admin' OR employees.role = 'supervisor')
    )
  );
