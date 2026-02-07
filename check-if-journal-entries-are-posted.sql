-- =============================================
-- CHECK IF JOURNAL ENTRIES ARE ACTUALLY POSTED
-- =============================================
-- All cleared transactions have journal entries
-- But Chart of Accounts doesn't match
-- Need to check if those journal entries are POSTED

-- Step 1: Check journal entries for these 4 specific transactions
SELECT 
    je.entry_number,
    je.entry_date,
    je.description,
    je.is_posted,
    je.reference_type,
    bt.amount as transaction_amount,
    bt.description as transaction_description
FROM journal_entries je
JOIN bank_transactions bt ON je.reference_id = bt.id AND je.reference_type = 'bank_transaction'
WHERE bt.bank_account_id = (SELECT id FROM bank_accounts WHERE account_name = 'Main Checking')
  AND bt.is_cleared = true
ORDER BY je.entry_date DESC;

-- Step 2: Check the journal entry LINES for these entries
SELECT 
    je.entry_number,
    je.is_posted,
    a.account_number,
    a.account_name,
    jel.debit,
    jel.credit,
    bt.description as transaction_desc
FROM journal_entries je
JOIN journal_entry_lines jel ON jel.entry_id = je.id
JOIN accounts a ON jel.account_id = a.id
JOIN bank_transactions bt ON je.reference_id = bt.id AND je.reference_type = 'bank_transaction'
WHERE bt.bank_account_id = (SELECT id FROM bank_accounts WHERE account_name = 'Main Checking')
  AND bt.is_cleared = true
ORDER BY je.entry_date DESC, jel.line_number;

-- Step 3: Find UNPOSTED journal entries
SELECT 
    je.entry_number,
    je.entry_date,
    je.description,
    je.is_posted,
    bt.amount,
    bt.description as transaction_description
FROM journal_entries je
JOIN bank_transactions bt ON je.reference_id = bt.id AND je.reference_type = 'bank_transaction'
WHERE bt.bank_account_id = (SELECT id FROM bank_accounts WHERE account_name = 'Main Checking')
  AND bt.is_cleared = true
  AND je.is_posted = false;

-- Step 4: Post any unposted journal entries (uncomment to run)
/*
DO $$
DECLARE
    v_entry_id UUID;
    v_entry_number VARCHAR;
BEGIN
    FOR v_entry_id, v_entry_number IN 
        SELECT je.id, je.entry_number
        FROM journal_entries je
        JOIN bank_transactions bt ON je.reference_id = bt.id AND je.reference_type = 'bank_transaction'
        WHERE bt.bank_account_id = (SELECT id FROM bank_accounts WHERE account_name = 'Main Checking')
          AND bt.is_cleared = true
          AND je.is_posted = false
    LOOP
        RAISE NOTICE 'Posting journal entry %', v_entry_number;
        PERFORM post_journal_entry(v_entry_id, (SELECT created_by FROM journal_entries WHERE id = v_entry_id));
    END LOOP;
END $$;
*/
