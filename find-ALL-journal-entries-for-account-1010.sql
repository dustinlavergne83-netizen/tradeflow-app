-- =============================================
-- FIND ALL JOURNAL ENTRIES FOR ACCOUNT #1010
-- =============================================
-- Chart of Accounts still shows $231.24
-- This means there are OTHER journal entries we haven't deleted

-- Step 1: Find ALL journal entries affecting account #1010
SELECT 
    je.entry_number,
    je.entry_date,
    je.description,
    je.reference_type,
    je.is_posted,
    jel.debit,
    jel.credit,
    je.created_at
FROM journal_entry_lines jel
JOIN journal_entries je ON jel.entry_id = je.id
JOIN accounts a ON jel.account_id = a.id
WHERE a.account_number = '1010'
  AND je.is_posted = true
ORDER BY je.entry_date DESC, je.created_at DESC;

-- Step 2: Calculate total from these entries (should match what UI shows)
SELECT 
    SUM(jel.debit) as total_debits,
    SUM(jel.credit) as total_credits,
    SUM(jel.debit) - SUM(jel.credit) as net_balance
FROM journal_entry_lines jel
JOIN journal_entries je ON jel.entry_id = je.id
JOIN accounts a ON jel.account_id = a.id
WHERE a.account_number = '1010'
  AND je.is_posted = true;

-- Step 3: DELETE ALL journal entries affecting account #1010 (uncomment to run)
/*
DELETE FROM journal_entries
WHERE id IN (
    SELECT DISTINCT je.id
    FROM journal_entries je
    JOIN journal_entry_lines jel ON jel.entry_id = je.id
    JOIN accounts a ON jel.account_id = a.id
    WHERE a.account_number = '1010'
);
*/

-- After deleting, Chart of Accounts should show $0.00 for account #1010
