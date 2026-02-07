-- Create journal_entries table (header/master record)
CREATE TABLE IF NOT EXISTS journal_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL,
    entry_number VARCHAR(50) NOT NULL,
    entry_date DATE NOT NULL,
    description TEXT,
    reference_type VARCHAR(50), -- 'manual', 'invoice', 'expense', 'payment', 'adjustment', etc.
    reference_id UUID, -- ID of the source document (invoice_id, expense_id, etc.)
    is_posted BOOLEAN DEFAULT false,
    posted_at TIMESTAMP WITH TIME ZONE,
    posted_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),
    
    -- Ensure entry numbers are unique per company
    UNIQUE(company_id, entry_number)
);

-- Create journal_entry_lines table (detail/line items - debits and credits)
CREATE TABLE IF NOT EXISTS journal_entry_lines (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    entry_id UUID NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
    line_number INTEGER NOT NULL, -- 1, 2, 3, etc. for ordering
    account_id UUID NOT NULL REFERENCES accounts(id),
    debit DECIMAL(15, 2) DEFAULT 0.00,
    credit DECIMAL(15, 2) DEFAULT 0.00,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure either debit or credit (not both, not neither)
    CONSTRAINT check_debit_or_credit CHECK (
        (debit > 0 AND credit = 0) OR (debit = 0 AND credit > 0)
    ),
    
    -- Ensure line numbers are unique within an entry
    UNIQUE(entry_id, line_number)
);

-- Create indexes for faster lookups
CREATE INDEX idx_journal_entries_company_id ON journal_entries(company_id);
CREATE INDEX idx_journal_entries_date ON journal_entries(entry_date);
CREATE INDEX idx_journal_entries_posted ON journal_entries(is_posted);
CREATE INDEX idx_journal_entries_reference ON journal_entries(reference_type, reference_id);
CREATE INDEX idx_journal_entry_lines_entry_id ON journal_entry_lines(entry_id);
CREATE INDEX idx_journal_entry_lines_account_id ON journal_entry_lines(account_id);

-- Enable Row Level Security
ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_entry_lines ENABLE ROW LEVEL SECURITY;

-- RLS Policies for journal_entries
CREATE POLICY "Users can view their company's journal entries"
    ON journal_entries FOR SELECT
    USING (
        company_id IN (
            SELECT company_id FROM profiles WHERE id = auth.uid()
        )
    );

CREATE POLICY "Users can create journal entries for their company"
    ON journal_entries FOR INSERT
    WITH CHECK (
        company_id IN (
            SELECT company_id FROM profiles WHERE id = auth.uid()
        )
    );

CREATE POLICY "Users can update their company's journal entries"
    ON journal_entries FOR UPDATE
    USING (
        company_id IN (
            SELECT company_id FROM profiles WHERE id = auth.uid()
        )
    );

CREATE POLICY "Users can delete their company's unposted journal entries"
    ON journal_entries FOR DELETE
    USING (
        company_id IN (
            SELECT company_id FROM profiles WHERE id = auth.uid()
        )
        AND is_posted = false
    );

-- RLS Policies for journal_entry_lines
CREATE POLICY "Users can view journal entry lines for their company's entries"
    ON journal_entry_lines FOR SELECT
    USING (
        entry_id IN (
            SELECT id FROM journal_entries WHERE company_id IN (
                SELECT company_id FROM profiles WHERE id = auth.uid()
            )
        )
    );

CREATE POLICY "Users can create journal entry lines for their company's entries"
    ON journal_entry_lines FOR INSERT
    WITH CHECK (
        entry_id IN (
            SELECT id FROM journal_entries WHERE company_id IN (
                SELECT company_id FROM profiles WHERE id = auth.uid()
            )
        )
    );

CREATE POLICY "Users can update journal entry lines for their company's entries"
    ON journal_entry_lines FOR UPDATE
    USING (
        entry_id IN (
            SELECT id FROM journal_entries WHERE company_id IN (
                SELECT company_id FROM profiles WHERE id = auth.uid()
            )
        )
    );

CREATE POLICY "Users can delete journal entry lines for their company's unposted entries"
    ON journal_entry_lines FOR DELETE
    USING (
        entry_id IN (
            SELECT id FROM journal_entries 
            WHERE company_id IN (
                SELECT company_id FROM profiles WHERE id = auth.uid()
            )
            AND is_posted = false
        )
    );

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_journal_entries_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
CREATE TRIGGER update_journal_entries_timestamp
    BEFORE UPDATE ON journal_entries
    FOR EACH ROW
    EXECUTE FUNCTION update_journal_entries_updated_at();

-- Function to validate journal entry is balanced (debits = credits)
CREATE OR REPLACE FUNCTION validate_journal_entry_balance(p_entry_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    total_debits DECIMAL(15, 2);
    total_credits DECIMAL(15, 2);
BEGIN
    SELECT 
        COALESCE(SUM(debit), 0),
        COALESCE(SUM(credit), 0)
    INTO total_debits, total_credits
    FROM journal_entry_lines
    WHERE entry_id = p_entry_id;
    
    RETURN total_debits = total_credits;
END;
$$ LANGUAGE plpgsql;

-- Function to post a journal entry (mark as posted and update account balances)
CREATE OR REPLACE FUNCTION post_journal_entry(p_entry_id UUID, p_user_id UUID)
RETURNS void AS $$
DECLARE
    v_is_balanced BOOLEAN;
    v_is_posted BOOLEAN;
    v_line RECORD;
    v_account RECORD;
BEGIN
    -- Check if entry exists and is not already posted
    SELECT is_posted INTO v_is_posted
    FROM journal_entries
    WHERE id = p_entry_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Journal entry not found';
    END IF;
    
    IF v_is_posted THEN
        RAISE EXCEPTION 'Journal entry is already posted';
    END IF;
    
    -- Validate entry is balanced
    v_is_balanced := validate_journal_entry_balance(p_entry_id);
    
    IF NOT v_is_balanced THEN
        RAISE EXCEPTION 'Journal entry is not balanced. Debits must equal credits';
    END IF;
    
    -- Update account balances
    FOR v_line IN 
        SELECT account_id, debit, credit
        FROM journal_entry_lines
        WHERE entry_id = p_entry_id
    LOOP
        -- Get account info
        SELECT * INTO v_account
        FROM accounts
        WHERE id = v_line.account_id;
        
        -- Update balance based on normal balance side
        IF v_account.normal_balance = 'debit' THEN
            -- Debit normal accounts: increase with debits, decrease with credits
            UPDATE accounts
            SET balance = balance + v_line.debit - v_line.credit
            WHERE id = v_line.account_id;
        ELSE
            -- Credit normal accounts: increase with credits, decrease with debits
            UPDATE accounts
            SET balance = balance + v_line.credit - v_line.debit
            WHERE id = v_line.account_id;
        END IF;
    END LOOP;
    
    -- Mark entry as posted
    UPDATE journal_entries
    SET is_posted = true,
        posted_at = NOW(),
        posted_by = p_user_id
    WHERE id = p_entry_id;
END;
$$ LANGUAGE plpgsql;

-- Function to generate next journal entry number
CREATE OR REPLACE FUNCTION get_next_journal_entry_number(p_company_id UUID)
RETURNS VARCHAR AS $$
DECLARE
    v_count INTEGER;
    v_year VARCHAR(4);
BEGIN
    v_year := EXTRACT(YEAR FROM CURRENT_DATE)::VARCHAR;
    
    SELECT COUNT(*) INTO v_count
    FROM journal_entries
    WHERE company_id = p_company_id
    AND entry_number LIKE 'JE-' || v_year || '-%';
    
    RETURN 'JE-' || v_year || '-' || LPAD((v_count + 1)::VARCHAR, 5, '0');
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE journal_entries IS 'General Ledger journal entries (header/master records)';
COMMENT ON TABLE journal_entry_lines IS 'Journal entry line items (debits and credits)';
COMMENT ON COLUMN journal_entries.reference_type IS 'Type of source document: manual, invoice, expense, payment, etc.';
COMMENT ON COLUMN journal_entries.reference_id IS 'ID of the source document (if applicable)';
COMMENT ON COLUMN journal_entries.is_posted IS 'Posted entries are final and affect account balances';
COMMENT ON FUNCTION validate_journal_entry_balance IS 'Validates that total debits equal total credits for a journal entry';
COMMENT ON FUNCTION post_journal_entry IS 'Posts a journal entry, updates account balances, and marks as posted';
COMMENT ON FUNCTION get_next_journal_entry_number IS 'Generates next sequential journal entry number (JE-YYYY-00001)';
