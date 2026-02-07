-- Fix Duplicate Journal Entries from Bank Transaction Testing
-- This script will help identify and remove duplicate/incorrect journal entries

-- STEP 1: View all recent journal entries to identify duplicates
SELECT 
    je.id,
    je.entry_number,
    je.entry_date,
    je.description,
    je.is_posted,
    je.posted_at,
    je.reference_type,
    je.reference_id
FROM journal_entries je
WHERE je.reference_type = 'bank_transaction'
ORDER BY je.created_at DESC
LIMIT 20;

-- STEP 2: View the lines for these entries to see which ones are wrong
-- Replace 'ENTRY_ID_HERE' with the IDs from Step 1
SELECT 
    jel.id,
    jel.entry_id,
    jel.line_number,
    a.account_number,
    a.account_name,
    jel.debit,
    jel.credit,
    jel.description
FROM journal_entry_lines jel
JOIN accounts a ON jel.account_id = a.id
WHERE jel.entry_id IN (
    SELECT id FROM journal_entries 
    WHERE reference_type = 'bank_transaction'
    ORDER BY created_at DESC
    LIMIT 10
)
ORDER BY jel.entry_id, jel.line_number;

-- STEP 3: After identifying the wrong entries, UNPOST them first
-- Replace 'WRONG_ENTRY_ID_HERE' with the actual ID
/*
-- This will reverse the account balance changes
DO $$
DECLARE
    v_entry_id UUID := 'WRONG_ENTRY_ID_HERE';
    v_line RECORD;
    v_account RECORD;
BEGIN
    -- For each line in the entry
    FOR v_line IN 
        SELECT account_id, debit, credit
        FROM journal_entry_lines
        WHERE entry_id = v_entry_id
    LOOP
        -- Get account info
        SELECT * INTO v_account
        FROM accounts
        WHERE id = v_line.account_id;
        
        -- REVERSE the balance change
        IF v_account.normal_balance = 'debit' THEN
            -- Debit normal accounts: SUBTRACT what was added
            UPDATE accounts
            SET balance = balance - v_line.debit + v_line.credit
            WHERE id = v_line.account_id;
        ELSE
            -- Credit normal accounts: SUBTRACT what was added  
            UPDATE accounts
            SET balance = balance - v_line.credit + v_line.debit
            WHERE id = v_line.account_id;
        END IF;
    END LOOP;
    
    -- Mark entry as unposted
    UPDATE journal_entries
    SET is_posted = false,
        posted_at = NULL,
        posted_by = NULL
    WHERE id = v_entry_id;
END $$;
*/

-- STEP 4: Delete the wrong journal entry lines
-- DELETE FROM journal_entry_lines WHERE entry_id = 'WRONG_ENTRY_ID_HERE';

-- STEP 5: Delete the wrong journal entry header
-- DELETE FROM journal_entries WHERE id = 'WRONG_ENTRY_ID_HERE';

-- ALTERNATIVE QUICK FIX: Delete ALL journal entries for bank transactions and start fresh
-- WARNING: Only use this if you want to completely reset and relink the transaction
/*
-- Find the entry IDs
SELECT id FROM journal_entries WHERE reference_type = 'bank_transaction';

-- Delete the lines first
DELETE FROM journal_entry_lines 
WHERE entry_id IN (SELECT id FROM journal_entries WHERE reference_type = 'bank_transaction');

-- Then delete the headers
DELETE FROM journal_entries WHERE reference_type = 'bank_transaction';

-- Note: You'll need to manually adjust account balances back to what they should be
-- Or you can restore from a backup
*/
