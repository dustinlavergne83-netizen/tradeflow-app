-- =============================================
-- CREATE JOURNAL ENTRIES FOR INVOICES #1001 and #1002
-- =============================================
-- After deleting all journal entries, need to recreate entries for existing invoices
-- This creates the initial invoice journal entries (AR debit, Revenue credit)

DO $$
DECLARE
    v_user_id UUID;
    v_ar_account_id UUID;
    v_revenue_account_id UUID;
    v_entry_id UUID;
BEGIN
    -- Get user ID from invoice #1001
    SELECT created_by INTO v_user_id FROM invoices WHERE invoice_number = '1001' LIMIT 1;
    
    -- Get Accounts Receivable account (1100)
    SELECT id INTO v_ar_account_id FROM accounts WHERE account_number = '1100';
    
    -- Get Service Revenue account (4000)
    SELECT id INTO v_revenue_account_id FROM accounts WHERE account_number = '4000';
    
    -- Create journal entry for Invoice #1001 ($5,330.00)
    INSERT INTO journal_entries (company_id, entry_number, entry_date, description, reference_type, reference_id, is_posted, posted_at, posted_by, created_by)
    SELECT 
        v_user_id,
        'JE-2026-00001',
        invoice_date,
        'Invoice #1001 - Dusty Ridge Generators',
        'invoice',
        id,
        true,
        NOW(),
        v_user_id,
        v_user_id
    FROM invoices WHERE invoice_number = '1001'
    RETURNING id INTO v_entry_id;
    
    -- Create journal entry lines for Invoice #1001
    INSERT INTO journal_entry_lines (entry_id, line_number, account_id, debit, credit, description) VALUES
    (v_entry_id, 1, v_ar_account_id, 5330.00, 0, 'Accounts Receivable'), -- Debit AR
    (v_entry_id, 2, v_revenue_account_id, 0, 5330.00, 'Revenue'); -- Credit Revenue
    
    -- Update AR and Revenue account balances
    UPDATE accounts SET balance = balance + 5330.00 WHERE id = v_ar_account_id;
    UPDATE accounts SET balance = balance + 5330.00 WHERE id = v_revenue_account_id;
    
    -- Create journal entry for Invoice #1002 ($240.00)
    INSERT INTO journal_entries (company_id, entry_number, entry_date, description, reference_type, reference_id, is_posted, posted_at, posted_by, created_by)
    SELECT 
        v_user_id,
        'JE-2026-00002',
        invoice_date,
        'Invoice #1002 - Service Call',
        'invoice',
        id,
        true,
        NOW(),
        v_user_id,
        v_user_id
    FROM invoices WHERE invoice_number = '1002'
    RETURNING id INTO v_entry_id;
    
    -- Create journal entry lines for Invoice #1002
    INSERT INTO journal_entry_lines (entry_id, line_number, account_id, debit, credit, description) VALUES
    (v_entry_id, 1, v_ar_account_id, 240.00, 0, 'Accounts Receivable'), -- Debit AR
    (v_entry_id, 2, v_revenue_account_id, 0, 240.00, 'Revenue'); -- Credit Revenue
    
    -- Update AR and Revenue account balances
    UPDATE accounts SET balance = balance + 240.00 WHERE id = v_ar_account_id;
    UPDATE accounts SET balance = balance + 240.00 WHERE id = v_revenue_account_id;
    
    RAISE NOTICE 'Journal entries created for invoices #1001 and #1002';
END $$;

-- Verify the entries were created
SELECT 
    je.entry_number,
    je.description,
    je.is_posted,
    jel.line_number,
    a.account_number,
    a.account_name,
    jel.debit,
    jel.credit
FROM journal_entries je
JOIN journal_entry_lines jel ON jel.entry_id = je.id
JOIN accounts a ON jel.account_id = a.id
WHERE je.entry_number IN ('JE-2026-00001', 'JE-2026-00002')
ORDER BY je.entry_number, jel.line_number;
