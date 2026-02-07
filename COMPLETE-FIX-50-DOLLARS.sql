-- ============================================
-- COMPLETE FIX: Add $50 with ALL steps
-- Creates bank transaction + journal entry + posts it
-- ============================================

DO $$
DECLARE
    v_user_id UUID;
    v_bank_account_table_id UUID;
    v_bank_chart_account_id UUID;
    v_equity_account_id UUID;
    v_entry_id UUID;
    v_transaction_id UUID;
    v_entry_number TEXT;
BEGIN
    -- Get user ID
    SELECT id INTO v_user_id FROM auth.users LIMIT 1;
    RAISE NOTICE 'User ID: %', v_user_id;
    
    -- Find bank account in bank_accounts table
    SELECT id, chart_account_id INTO v_bank_account_table_id, v_bank_chart_account_id
    FROM bank_accounts
    WHERE account_name ILIKE '%checking%'
    LIMIT 1;
    
    RAISE NOTICE 'Bank account ID: %, Chart Account ID: %', v_bank_account_table_id, v_bank_chart_account_id;
    
    -- If no chart account linked, find it by name
    IF v_bank_chart_account_id IS NULL THEN
        SELECT id INTO v_bank_chart_account_id
        FROM accounts
        WHERE (account_name ILIKE '%checking%' OR account_number = '1010')
        AND company_id = v_user_id
        LIMIT 1;
        
        RAISE NOTICE 'Found chart account by name: %', v_bank_chart_account_id;
    END IF;
    
    -- Get/create equity account
    SELECT id INTO v_equity_account_id
    FROM accounts  
    WHERE (account_name ILIKE '%equity%' OR account_number = '3000')
    AND company_id = v_user_id
    LIMIT 1;
    
    IF v_equity_account_id IS NULL THEN
        INSERT INTO accounts (company_id, account_number, account_name, account_type, normal_balance, is_active)
        VALUES (v_user_id, '3000', 'Owner''s Equity', 'Equity', 'credit', true)
        RETURNING id INTO v_equity_account_id;
        RAISE NOTICE 'Created equity account: %', v_equity_account_id;
    ELSE
        RAISE NOTICE 'Found equity account: %', v_equity_account_id;
    END IF;
    
    -- Create bank transaction
    INSERT INTO bank_transactions (
        bank_account_id,
        transaction_date,
        description,
        amount,
        transaction_type,
        category,
        is_cleared,
        created_by
    ) VALUES (
        v_bank_account_table_id,
        '2025-12-02',
        'Opening Balance',
        50.00,
        'deposit',
        v_equity_account_id,
        true,
        v_user_id
    ) RETURNING id INTO v_transaction_id;
    
    RAISE NOTICE 'Created bank transaction: %', v_transaction_id;
    
    -- Get next journal entry number
    SELECT 'JE-2025-' || LPAD((COALESCE(MAX(CAST(SUBSTRING(entry_number FROM 9) AS INTEGER)), 0) + 1)::text, 5, '0')
    INTO v_entry_number
    FROM journal_entries
    WHERE company_id = v_user_id AND entry_number LIKE 'JE-2025-%';
    
    RAISE NOTICE 'Entry number: %', v_entry_number;
    
    -- Create journal entry
    INSERT INTO journal_entries (
        entry_number,
        entry_date,
        description,
        reference_type,
        reference_id,
        is_posted,
        created_by,
        company_id
    ) VALUES (
        v_entry_number,
        '2025-12-02',
        'Opening Balance - $50 Deposit',
        'bank_transaction',
        v_transaction_id,
        false,
        v_user_id,
        v_user_id
    ) RETURNING id INTO v_entry_id;
    
    RAISE NOTICE 'Created journal entry: %', v_entry_id;
    
    -- Create journal lines
    INSERT INTO journal_entry_lines (entry_id, line_number, account_id, debit, credit, description)
    VALUES
    (v_entry_id, 1, v_bank_chart_account_id, 50.00, 0, 'Opening balance deposit'),
    (v_entry_id, 2, v_equity_account_id, 0, 50.00, 'Opening balance equity');
    
    RAISE NOTICE 'Created journal lines';
    
    -- Post the journal entry
    PERFORM post_journal_entry(v_entry_id, v_user_id);
    
    RAISE NOTICE '✓✓✓ SUCCESS! All steps completed ✓✓✓';
    RAISE NOTICE 'Bank Transaction ID: %', v_transaction_id;
    RAISE NOTICE 'Journal Entry: %', v_entry_number;
    RAISE NOTICE 'Posted and account balances updated!';
    
END $$;

-- Show results
SELECT 'Bank Transaction Created' as status, * FROM bank_transactions WHERE description = 'Opening Balance' ORDER BY created_at DESC LIMIT 1;
SELECT 'Journal Entry Created' as status, * FROM journal_entries WHERE description LIKE '%Opening Balance%' ORDER BY created_at DESC LIMIT 1;
SELECT 'Account Balances' as status, account_number, account_name, balance FROM accounts WHERE account_number IN ('1010', '3000');
