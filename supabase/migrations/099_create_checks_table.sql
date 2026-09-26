-- ═══════════════════════════════════════════════════════════════════════
--  Check Printing — checks + check_stub_lines
--  Lets a company print physical checks from TradeFlow onto pre-printed
--  voucher stock (company name, bank name, MICR line, check number
--  already printed by the bank/check vendor). TradeFlow prints only the
--  variable fields: date, payee, amount, amount-in-words, memo, and the
--  remittance stub detail (which bill(s)/expense this check pays).
--
--  Convention: follows vendors.sql / bank_accounts — company_id is the
--  admin's auth.uid() (same pattern the rest of the app already uses),
--  scoped per bank account so DML and DT check sequences never collide.
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS checks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL,
    bank_account_id UUID NOT NULL REFERENCES bank_accounts(id) ON DELETE CASCADE,
    check_number INTEGER NOT NULL,
    check_date DATE NOT NULL,
    payee_name TEXT NOT NULL,
    payee_type VARCHAR(20) DEFAULT 'manual', -- 'vendor' | 'manual'
    vendor_id UUID REFERENCES vendors(id),
    amount DECIMAL(15, 2) NOT NULL,
    amount_words TEXT NOT NULL,
    memo TEXT,
    category_account_id UUID REFERENCES accounts(id), -- expense account for manual (non-bill) checks
    source_type VARCHAR(20) NOT NULL DEFAULT 'manual', -- 'manual' | 'bill' | 'expense'
    status VARCHAR(20) NOT NULL DEFAULT 'draft', -- 'draft' | 'printed' | 'voided'
    printed_at TIMESTAMP WITH TIME ZONE,
    voided_at TIMESTAMP WITH TIME ZONE,
    void_reason TEXT,
    bank_transaction_id UUID REFERENCES bank_transactions(id),
    journal_entry_id UUID REFERENCES journal_entries(id),
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(bank_account_id, check_number)
);

-- One row per bill (or memo line) paid by a check — supports combining
-- several bills from the same vendor into a single check, and always
-- gives the printed voucher stub something itemized to show.
CREATE TABLE IF NOT EXISTS check_stub_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    check_id UUID NOT NULL REFERENCES checks(id) ON DELETE CASCADE,
    bill_id UUID REFERENCES bills(id),
    description TEXT NOT NULL,
    reference TEXT, -- bill number / invoice number / free text
    amount DECIMAL(15, 2) NOT NULL,
    line_number INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_checks_company_id ON checks(company_id);
CREATE INDEX IF NOT EXISTS idx_checks_bank_account_id ON checks(bank_account_id);
CREATE INDEX IF NOT EXISTS idx_checks_status ON checks(status);
CREATE INDEX IF NOT EXISTS idx_check_stub_lines_check_id ON check_stub_lines(check_id);
CREATE INDEX IF NOT EXISTS idx_check_stub_lines_bill_id ON check_stub_lines(bill_id);

-- Per-bank-account printer calibration + sequencing, so DML and DT each
-- keep their own next-check-number and their own alignment offsets.
ALTER TABLE bank_accounts ADD COLUMN IF NOT EXISTS last_check_number_used INTEGER;
ALTER TABLE bank_accounts ADD COLUMN IF NOT EXISTS check_offset_x DECIMAL(6,3) NOT NULL DEFAULT 0;
ALTER TABLE bank_accounts ADD COLUMN IF NOT EXISTS check_offset_y DECIMAL(6,3) NOT NULL DEFAULT 0;

-- Enable RLS
ALTER TABLE checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE check_stub_lines ENABLE ROW LEVEL SECURITY;

-- RLS — company_id = auth.uid(), matching vendors.sql (the pattern this
-- app actually queries with, i.e. .eq("company_id", user.id) everywhere)
DROP POLICY IF EXISTS "Users can view their own checks" ON checks;
DROP POLICY IF EXISTS "Users can insert their own checks" ON checks;
DROP POLICY IF EXISTS "Users can update their own checks" ON checks;
DROP POLICY IF EXISTS "Users can delete their own draft checks" ON checks;

CREATE POLICY "Users can view their own checks"
    ON checks FOR SELECT
    USING (auth.uid() = company_id);

CREATE POLICY "Users can insert their own checks"
    ON checks FOR INSERT
    WITH CHECK (auth.uid() = company_id);

CREATE POLICY "Users can update their own checks"
    ON checks FOR UPDATE
    USING (auth.uid() = company_id);

CREATE POLICY "Users can delete their own draft checks"
    ON checks FOR DELETE
    USING (auth.uid() = company_id AND status = 'draft');

DROP POLICY IF EXISTS "Users can view stub lines for their checks" ON check_stub_lines;
DROP POLICY IF EXISTS "Users can insert stub lines for their checks" ON check_stub_lines;
DROP POLICY IF EXISTS "Users can update stub lines for their checks" ON check_stub_lines;
DROP POLICY IF EXISTS "Users can delete stub lines for their draft checks" ON check_stub_lines;

CREATE POLICY "Users can view stub lines for their checks"
    ON check_stub_lines FOR SELECT
    USING (check_id IN (SELECT id FROM checks WHERE company_id = auth.uid()));

CREATE POLICY "Users can insert stub lines for their checks"
    ON check_stub_lines FOR INSERT
    WITH CHECK (check_id IN (SELECT id FROM checks WHERE company_id = auth.uid()));

CREATE POLICY "Users can update stub lines for their checks"
    ON check_stub_lines FOR UPDATE
    USING (check_id IN (SELECT id FROM checks WHERE company_id = auth.uid()));

CREATE POLICY "Users can delete stub lines for their draft checks"
    ON check_stub_lines FOR DELETE
    USING (check_id IN (SELECT id FROM checks WHERE company_id = auth.uid() AND status = 'draft'));

-- Keep updated_at fresh
CREATE OR REPLACE FUNCTION update_checks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_checks_timestamp ON checks;
CREATE TRIGGER update_checks_timestamp
    BEFORE UPDATE ON checks
    FOR EACH ROW
    EXECUTE FUNCTION update_checks_updated_at();

COMMENT ON TABLE checks IS 'Physical checks printed from TradeFlow onto pre-printed voucher stock (blank fields only: date, payee, amount, memo)';
COMMENT ON TABLE check_stub_lines IS 'Itemized remittance-stub detail for a check — one row per bill (or memo line) the check pays';
COMMENT ON COLUMN bank_accounts.last_check_number_used IS 'Last physical check number printed for this account — next check pre-fills to this + 1';
COMMENT ON COLUMN bank_accounts.check_offset_x IS 'Printer calibration: horizontal offset in inches applied to the whole check layout';
COMMENT ON COLUMN bank_accounts.check_offset_y IS 'Printer calibration: vertical offset in inches applied to the whole check layout';
