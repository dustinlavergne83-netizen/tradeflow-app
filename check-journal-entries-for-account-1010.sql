-- =============================================
-- CHECK JOURNAL ENTRIES FOR ACCOUNT #1010
-- =============================================
-- The Chart of Accounts UI calculates balance from journal_entry_lines
-- NOT from accounts.balance field

-- Step 1: Check account #1010 details
SELECT 
    id,
    account_number,
    account_name,
    balance as stored_balance,
    normal_balance
FROM accounts
WHERE account_number = '1010';

-- Step 2: Check ALL journal entry lines for account #1010
SELECT 
    je.entry_number,
    je.entry_date,
    je.description,
    je.is_posted,
    jel.debit,
    jel.credit,
    je.reference_type,
    je.created_at
FROM journal_entry_lines jel
JOIN journal_entries je ON jel.entry_id = je.id
JOIN accounts a ON jel.account_id = a.id
WHERE a.account_number = '1010'
ORDER BY je.entry_date DESC, je.created_at DESC
LIMIT 50;

-- Step 3: Calculate balance from posted journal entries (same as UI does)
SELECT 
    a.account_number,
    a.account_name,
    COALESCE(SUM(jel.debit), 0) as total_debits,
    COALESCE(SUM(jel.credit), 0) as total_credits,
    CASE 
        WHEN a.normal_balance = 'debit' THEN COALESCE(SUM(jel.debit), 0) - COALESCE(SUM(jel.credit), 0)
        ELSE COALESCE(SUM(jel.credit), 0) - COALESCE(SUM(jel.debit), 0)
    END as calculated_balance
FROM accounts a
LEFT JOIN journal_entry_lines jel ON jel.account_id = a.id
LEFT JOIN journal_entries je ON jel.entry_id = je.id AND je.is_posted = true
WHERE a.account_number = '1010'
GROUP BY a.id, a.account_number, a.account_name, a.normal_balance;

-- Step 4: Check if journal entries exist but aren't POSTED
SELECT 
    je.entry_number,
    je.entry_date,
    je.description,
    je.is_posted,
    jel.debit,
    jel.credit
FROM journal_entry_lines jel
JOIN journal_entries je ON jel.entry_id = je.id
JOIN accounts a ON jel.account_id = a.id
WHERE a.account_number = '1010'
  AND je.is_posted = false
ORDER BY je.entry_date DESC;
