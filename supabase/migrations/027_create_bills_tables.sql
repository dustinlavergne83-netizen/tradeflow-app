-- Create bills table (Accounts Payable)
CREATE TABLE IF NOT EXISTS bills (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL,
    bill_number VARCHAR(50) NOT NULL,
    vendor_name VARCHAR(255) NOT NULL,
    vendor_email VARCHAR(255),
    vendor_address TEXT,
    bill_date DATE NOT NULL,
    due_date DATE NOT NULL,
    subtotal DECIMAL(15, 2) NOT NULL DEFAULT 0,
    tax_amount DECIMAL(15, 2) DEFAULT 0,
    total_amount DECIMAL(15, 2) NOT NULL,
    amount_paid DECIMAL(15, 2) DEFAULT 0,
    amount_due DECIMAL(15, 2) NOT NULL,
    status VARCHAR(50) DEFAULT 'unpaid', -- 'unpaid', 'partial', 'paid', 'overdue'
    expense_account_id UUID REFERENCES accounts(id), -- Link to expense account in chart of accounts
    notes TEXT,
    attachment_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),
    UNIQUE(company_id, bill_number)
);

-- Create bill_line_items table (for itemized bills)
CREATE TABLE IF NOT EXISTS bill_line_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    bill_id UUID NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
    line_number INTEGER NOT NULL,
    description TEXT NOT NULL,
    quantity DECIMAL(10, 2) DEFAULT 1,
    unit_price DECIMAL(15, 2) NOT NULL,
    amount DECIMAL(15, 2) NOT NULL,
    account_id UUID REFERENCES accounts(id), -- Link to specific expense account
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create bill_payments table
CREATE TABLE IF NOT EXISTS bill_payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    bill_id UUID NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
    payment_date DATE NOT NULL,
    amount DECIMAL(15, 2) NOT NULL,
    payment_method VARCHAR(50) DEFAULT 'check', -- 'check', 'cash', 'ach', 'wire', 'credit_card', 'other'
    check_number VARCHAR(50),
    reference_number VARCHAR(100),
    bank_account_id UUID REFERENCES bank_accounts(id), -- Which account payment came from
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id)
);

-- Create indexes
CREATE INDEX idx_bills_company_id ON bills(company_id);
CREATE INDEX idx_bills_status ON bills(status);
CREATE INDEX idx_bills_due_date ON bills(due_date);
CREATE INDEX idx_bills_vendor_name ON bills(vendor_name);
CREATE INDEX idx_bill_line_items_bill_id ON bill_line_items(bill_id);
CREATE INDEX idx_bill_payments_bill_id ON bill_payments(bill_id);
CREATE INDEX idx_bill_payments_date ON bill_payments(payment_date);

-- Enable Row Level Security
ALTER TABLE bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE bill_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE bill_payments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for bills
CREATE POLICY "Users can view their company's bills"
    ON bills FOR SELECT
    USING (
        company_id IN (
            SELECT company_id FROM profiles WHERE id = auth.uid()
        )
    );

CREATE POLICY "Users can create bills for their company"
    ON bills FOR INSERT
    WITH CHECK (
        company_id IN (
            SELECT company_id FROM profiles WHERE id = auth.uid()
        )
    );

CREATE POLICY "Users can update their company's bills"
    ON bills FOR UPDATE
    USING (
        company_id IN (
            SELECT company_id FROM profiles WHERE id = auth.uid()
        )
    );

CREATE POLICY "Users can delete their company's bills"
    ON bills FOR DELETE
    USING (
        company_id IN (
            SELECT company_id FROM profiles WHERE id = auth.uid()
        )
    );

-- RLS Policies for bill_line_items
CREATE POLICY "Users can view line items for their company's bills"
    ON bill_line_items FOR SELECT
    USING (
        bill_id IN (
            SELECT id FROM bills WHERE company_id IN (
                SELECT company_id FROM profiles WHERE id = auth.uid()
            )
        )
    );

CREATE POLICY "Users can create line items for their company's bills"
    ON bill_line_items FOR INSERT
    WITH CHECK (
        bill_id IN (
            SELECT id FROM bills WHERE company_id IN (
                SELECT company_id FROM profiles WHERE id = auth.uid()
            )
        )
    );

CREATE POLICY "Users can update line items for their company's bills"
    ON bill_line_items FOR UPDATE
    USING (
        bill_id IN (
            SELECT id FROM bills WHERE company_id IN (
                SELECT company_id FROM profiles WHERE id = auth.uid()
            )
        )
    );

CREATE POLICY "Users can delete line items for their company's bills"
    ON bill_line_items FOR DELETE
    USING (
        bill_id IN (
            SELECT id FROM bills WHERE company_id IN (
                SELECT company_id FROM profiles WHERE id = auth.uid()
            )
        )
    );

-- RLS Policies for bill_payments
CREATE POLICY "Users can view payments for their company's bills"
    ON bill_payments FOR SELECT
    USING (
        bill_id IN (
            SELECT id FROM bills WHERE company_id IN (
                SELECT company_id FROM profiles WHERE id = auth.uid()
            )
        )
    );

CREATE POLICY "Users can create payments for their company's bills"
    ON bill_payments FOR INSERT
    WITH CHECK (
        bill_id IN (
            SELECT id FROM bills WHERE company_id IN (
                SELECT company_id FROM profiles WHERE id = auth.uid()
            )
        )
    );

CREATE POLICY "Users can update payments for their company's bills"
    ON bill_payments FOR UPDATE
    USING (
        bill_id IN (
            SELECT id FROM bills WHERE company_id IN (
                SELECT company_id FROM profiles WHERE id = auth.uid()
            )
        )
    );

CREATE POLICY "Users can delete payments for their company's bills"
    ON bill_payments FOR DELETE
    USING (
        bill_id IN (
            SELECT id FROM bills WHERE company_id IN (
                SELECT company_id FROM profiles WHERE id = auth.uid()
            )
        )
    );

-- Function to update bill status and amounts when payments are made
CREATE OR REPLACE FUNCTION update_bill_payment_status()
RETURNS TRIGGER AS $$
DECLARE
    v_total_paid DECIMAL(15, 2);
    v_bill_total DECIMAL(15, 2);
    v_new_status VARCHAR(50);
BEGIN
    -- Get total amount paid for this bill
    SELECT COALESCE(SUM(amount), 0)
    INTO v_total_paid
    FROM bill_payments
    WHERE bill_id = COALESCE(NEW.bill_id, OLD.bill_id);
    
    -- Get bill total
    SELECT total_amount
    INTO v_bill_total
    FROM bills
    WHERE id = COALESCE(NEW.bill_id, OLD.bill_id);
    
    -- Determine status
    IF v_total_paid = 0 THEN
        v_new_status := 'unpaid';
    ELSIF v_total_paid >= v_bill_total THEN
        v_new_status := 'paid';
    ELSE
        v_new_status := 'partial';
    END IF;
    
    -- Update bill
    UPDATE bills
    SET 
        amount_paid = v_total_paid,
        amount_due = v_bill_total - v_total_paid,
        status = v_new_status,
        updated_at = NOW()
    WHERE id = COALESCE(NEW.bill_id, OLD.bill_id);
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Triggers to update bill payment status
CREATE TRIGGER update_bill_after_payment_insert
    AFTER INSERT ON bill_payments
    FOR EACH ROW
    EXECUTE FUNCTION update_bill_payment_status();

CREATE TRIGGER update_bill_after_payment_update
    AFTER UPDATE ON bill_payments
    FOR EACH ROW
    WHEN (OLD.amount IS DISTINCT FROM NEW.amount)
    EXECUTE FUNCTION update_bill_payment_status();

CREATE TRIGGER update_bill_after_payment_delete
    AFTER DELETE ON bill_payments
    FOR EACH ROW
    EXECUTE FUNCTION update_bill_payment_status();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_bills_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
CREATE TRIGGER update_bills_timestamp
    BEFORE UPDATE ON bills
    FOR EACH ROW
    EXECUTE FUNCTION update_bills_updated_at();

-- Function to generate next bill number
CREATE OR REPLACE FUNCTION get_next_bill_number(p_company_id UUID)
RETURNS TEXT AS $$
DECLARE
    v_year TEXT;
    v_count INTEGER;
    v_bill_number TEXT;
BEGIN
    v_year := TO_CHAR(NOW(), 'YYYY');
    
    -- Get count of bills for this year
    SELECT COUNT(*) + 1
    INTO v_count
    FROM bills
    WHERE company_id = p_company_id
    AND bill_number LIKE 'BILL-' || v_year || '-%';
    
    -- Format: BILL-2026-00001
    v_bill_number := 'BILL-' || v_year || '-' || LPAD(v_count::TEXT, 5, '0');
    
    RETURN v_bill_number;
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE bills IS 'Vendor bills for accounts payable tracking';
COMMENT ON TABLE bill_line_items IS 'Line items for bills (itemized expenses)';
COMMENT ON TABLE bill_payments IS 'Payments made towards bills';
COMMENT ON COLUMN bills.status IS 'unpaid, partial, paid, overdue';
COMMENT ON COLUMN bills.amount_due IS 'Remaining amount to be paid (total_amount - amount_paid)';
COMMENT ON FUNCTION update_bill_payment_status IS 'Automatically updates bill status and amounts when payments are made';
COMMENT ON FUNCTION get_next_bill_number IS 'Generates sequential bill numbers (BILL-YYYY-00001)';
