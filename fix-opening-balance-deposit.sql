-- ============================================
-- FIX $50 OPENING BALANCE DEPOSIT
-- Creates journal entry to record opening balance
-- ============================================

DO $$
DECLARE
    v_user_id UUID;
    v_bank_account_id UUID;
    v_equity_account_id UUID;
    v_entry_number TEXT;
    v_entry_id UUID;
    v_next_number INTEGER;
BEGIN
    -- Get the user ID (assuming there's only one user, or get the first one)
    SELECT id INTO v_user_id FROM auth.users LIMIT 1;
    
    RAISE NOTICE 'User ID: %', v_user_id;
    
    -- Get the HW Business Checking account ID from Chart of Accounts
    -- Try by name first since account number might not be set
    SELECT id INTO v_bank_account_id 
    FROM accounts 
    WHERE (account_name ILIKE '%HW Business Checking%' OR account_number = '1010')
    AND company_id = v_user_id
    LIMIT 1;
    
    -- If bank account doesn't exist, create it
    IF v_bank_account_id IS NULL THEN
        INSERT INTO accounts (
            company_id,
            account_number,
            account_name,
            account_type,
            normal_balance,
            is_active,
            description
        ) VALUES (
            v_user_id,
            '1010',
            'HW Business Checking',
            'Asset',
            'debit',
            true,
            'Main business checking account'
        ) RETURNING id INTO v_bank_account_id;
        
        RAISE NOTICE 'Created HW Business Checking account: %', v_bank_account_id;
    ELSE
        RAISE NOTICE 'Found HW Business Checking account: %', v_bank_account_id;
    END IF;
    
    -- Get or create Owner's Equity account (3000)
    SELECT id INTO v_equity_account_id 
    FROM accounts 
    WHERE (account_name ILIKE '%Owner%Equity%' OR account_number = '3000')
    AND company_id = v_user_id
    LIMIT 1;
    
    -- If Owner's Equity doesn't exist, create it
    IF v_equity_account_id IS NULL THEN
        INSERT INTO accounts (
            company_id,
            account_number,
            account_name,
            account_type,
            normal_balance,
            is_active,
            description
        ) VALUES (
            v_user_id,
            '3000',
            'Owner''s Equity',
            'Equity',
            'credit',
            true,
            'Owner''s capital contributions and opening balances'
        ) RETURNING id INTO v_equity_account_id;
        
        RAISE NOTICE 'Created Owner''s Equity account: %', v_equity_account_id;
    ELSE
        RAISE NOTICE 'Found Owner''s Equity account: %', v_equity_account_id;
    END IF;
    
    -- Get next journal entry number
    SELECT COALESCE(
        MAX(CAST(SUBSTRING(entry_number FROM 9) AS INTEGER)), 0
    ) + 1 INTO v_next_number
    FROM journal_entries
    WHERE company_id = v_user_id
    AND entry_number LIKE 'JE-2025-%';
    
    -- Format as JE-YYYY-NNNNN
    v_entry_number := 'JE-2025-' || LPAD(v_next_number::text, 5, '0');
    
    -- Create journal entry (NOT posted yet - will post after lines are added)
    INSERT INTO journal_entries (
        entry_number,
        entry_date,
        description,
        reference_type,
        is_posted,
        created_by,
        company_id
    ) VALUES (
        v_entry_number,
        '2025-12-02',
        'Opening Balance - HW Business Checking',
        'bank_transaction',
        false,
        v_user_id,
        v_user_id
    ) RETURNING id INTO v_entry_id;
    
    RAISE NOTICE 'Created journal entry: % (ID: %)', v_entry_number, v_entry_id;
    
    -- Create journal entry lines
    -- Line 1: Debit Bank Account $50
    INSERT INTO journal_entry_lines (
        entry_id,
        line_number,
        account_id,
        debit,
        credit,
        description
    ) VALUES (
        v_entry_id,
        1,
        v_bank_account_id,
        50.00,
        0,
        'Opening balance deposit'
    );
    
    -- Line 2: Credit Owner's Equity $50
    INSERT INTO journal_entry_lines (
        entry_id,
        line_number,
        account_id,
        debit,
        credit,
        description
    ) VALUES (
        v_entry_id,
        2,
        v_equity_account_id,
        0,
        50.00,
        'Opening balance equity'
    );
    
    RAISE NOTICE 'Created journal entry lines';
    
    -- Post the journal entry (update account balances)
    PERFORM post_journal_entry(v_entry_id, v_user_id);
    
    RAISE NOTICE 'Posted journal entry - account balances updated';
    
    -- Show the results
    RAISE NOTICE '✓ SUCCESS! Journal entry % created and posted', v_entry_number;
    RAISE NOTICE 'Debit:  1010 - HW Business Checking  $50.00';
    RAISE NOTICE 'Credit: 3000 - Owner''s Equity         $50.00';
    
END $$;

-- Verify the results
SELECT 
    'Journal Entry' as type,
    je.entry_number,
    je.entry_date,
    je.description,
    SUM(jel.debit) as total_debits,
    SUM(jel.credit) as total_credits,
    CASE 
        WHEN SUM(jel.debit) = SUM(jel.credit) THEN '✓ BALANCED'
        ELSE '✗ UNBALANCED'
    END as status
FROM journal_entries je
JOIN journal_entry_lines jel ON je.id = jel.entry_id
WHERE je.description LIKE '%Opening Balance%'
GROUP BY je.id, je.entry_number, je.entry_date, je.description
ORDER BY je.entry_date DESC;

-- Show account balances
SELECT 
    a.account_number,
    a.account_name,
    a.account_type,
    a.balance as current_balance
FROM accounts a
WHERE a.account_number IN ('1010', '3000')
ORDER BY a.account_number;
