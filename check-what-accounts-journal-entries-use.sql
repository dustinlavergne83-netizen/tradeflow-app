-- =============================================
-- CHECK WHAT ACCOUNTS THE JOURNAL ENTRIES ARE USING
-- =============================================
-- All 4 transactions have posted journal entries
-- But Chart of Accounts only shows $231.24 instead of $397.16
-- Need to see which accounts they're posting to

-- Step 1: Show the journal entry lines for all 4 cleared transactions
SELECT 
    bt.transaction_date,
    bt.description as transaction_desc,
    bt.amount as trans_amount,
    je.entry_number,
    je.is_posted,
    a.account_number,
    a.account_name,
    jel.debit,
    jel.credit
FROM bank_transactions bt
JOIN journal_entries je ON je.reference_id = bt.id AND je.reference_type = 'bank_transaction'
JOIN journal_entry_lines jel ON jel.entry_id = je.id
JOIN accounts a ON jel.account_id = a.id
WHERE bt.bank_account_id = (SELECT id FROM bank_accounts WHERE account_name = 'Main Checking')
  AND bt.is_cleared = true
ORDER BY bt.transaction_date DESC, jel.line_number;

-- Step 2: Sum debits and credits for account #1010 from these entries
SELECT 
    'Account 1010 Total' as description,
    SUM(jel.debit) as total_debits,
    SUM(jel.credit) as total_credits,
    SUM(jel.debit) - SUM(jel.credit) as net_balance
FROM bank_transactions bt
JOIN journal_entries je ON je.reference_id = bt.id AND je.reference_type = 'bank_transaction'
JOIN journal_entry_lines jel ON jel.entry_id = je.id
JOIN accounts a ON jel.account_id = a.id
WHERE bt.bank_account_id = (SELECT id FROM bank_accounts WHERE account_name = 'Main Checking')
  AND bt.is_cleared = true
  AND a.account_number = '1010'
  AND je.is_posted = true;

-- Step 3: Check if bank_accounts.chart_account_id is correct
SELECT 
    ba.account_name as bank_account,
    ba.chart_account_id,
    a.account_number,
    a.account_name as chart_account_name
FROM bank_accounts ba
LEFT JOIN accounts a ON ba.chart_account_id = a.id
WHERE ba.account_name = 'Main Checking';
