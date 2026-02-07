-- =============================================
-- FIX MISSING JOURNAL ENTRIES FOR BANK ACCOUNT
-- =============================================
-- Bank account shows $397.16
-- Journal entries only show $231.24
-- Difference: $166 in missing journal entries

-- Step 1: Find cleared bank transactions WITHOUT journal entries
SELECT 
    bt.id,
    bt.transaction_date,
    bt.description,
    bt.amount,
    bt.transaction_type,
    bt.is_cleared,
    bt.created_at,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM journal_entries je 
            WHERE je.reference_type = 'bank_transaction' 
            AND je.reference_id = bt.id
        ) THEN 'Has Journal Entry'
        ELSE 'MISSING Journal Entry'
    END as journal_status
FROM bank_transactions bt
WHERE bt.bank_account_id = (SELECT id FROM bank_accounts WHERE account_name = 'Main Checking')
  AND bt.is_cleared = true
ORDER BY bt.transaction_date DESC;

-- Step 2: Calculate the difference
SELECT 
    ba.account_name,
    ba.current_balance as bank_balance,
    (SELECT 
        CASE 
            WHEN a.normal_balance = 'debit' THEN COALESCE(SUM(jel.debit), 0) - COALESCE(SUM(jel.credit), 0)
            ELSE COALESCE(SUM(jel.credit), 0) - COALESCE(SUM(jel.debit), 0)
        END
    FROM journal_entry_lines jel
    JOIN journal_entries je ON jel.entry_id = je.id AND je.is_posted = true
    WHERE jel.account_id = ba.chart_account_id
    ) as journal_balance,
    ba.current_balance - (SELECT 
        CASE 
            WHEN a.normal_balance = 'debit' THEN COALESCE(SUM(jel.debit), 0) - COALESCE(SUM(jel.credit), 0)
            ELSE COALESCE(SUM(jel.credit), 0) - COALESCE(SUM(jel.debit), 0)
        END
    FROM journal_entry_lines jel
    JOIN journal_entries je ON jel.entry_id = je.id AND je.is_posted = true
    WHERE jel.account_id = ba.chart_account_id
    ) as difference
FROM bank_accounts ba
JOIN accounts a ON ba.chart_account_id = a.id
WHERE ba.account_name = 'Main Checking';

-- Step 3: Find the specific transactions causing the difference
SELECT 
    bt.transaction_date,
    bt.description,
    bt.amount,
    'Missing Journal Entry' as issue
FROM bank_transactions bt
WHERE bt.bank_account_id = (SELECT id FROM bank_accounts WHERE account_name = 'Main Checking')
  AND bt.is_cleared = true
  AND NOT EXISTS (
      SELECT 1 FROM journal_entries je 
      WHERE je.reference_type = 'bank_transaction' 
      AND je.reference_id = bt.id
  )
ORDER BY bt.transaction_date DESC;
