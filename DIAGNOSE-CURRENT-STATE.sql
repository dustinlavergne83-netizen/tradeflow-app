-- DIAGNOSE: Check current state of data after the deletion

-- Check how many accounts exist and their current balances
SELECT 'ACCOUNTS' as section, COUNT(*) as count FROM accounts;
SELECT account_number, account_name, balance FROM accounts WHERE is_active = TRUE ORDER BY account_number;

-- Check how many bank transactions we have
SELECT 'BANK_TRANSACTIONS' as section, COUNT(*) as count FROM bank_transactions;
SELECT COUNT(*) as cleared_transactions FROM bank_transactions WHERE is_cleared = TRUE;
SELECT COUNT(*) as uncleared_transactions FROM bank_transactions WHERE is_cleared = FALSE;

-- Check journal entries status
SELECT 'JOURNAL_ENTRIES' as section, COUNT(*) as count FROM journal_entries;
SELECT 'JOURNAL_ENTRY_LINES' as section, COUNT(*) as count FROM journal_entry_lines;

-- Show sample bank transactions to understand structure
SELECT 'SAMPLE_BANK_TRANSACTIONS:' as info;
SELECT 
  id, 
  merchant_name, 
  transaction_type, 
  amount, 
  account_id,
  is_cleared,
  transaction_date
FROM bank_transactions 
LIMIT 10;

-- Check what account_id values point to
SELECT 'ACCOUNTS_LINKED_IN_TRANSACTIONS' as info;
SELECT DISTINCT 
  a.id,
  a.account_number,
  a.account_name,
  a.balance,
  COUNT(bt.id) as transaction_count
FROM accounts a
LEFT JOIN bank_transactions bt ON bt.account_id = a.id
WHERE a.is_active = TRUE
GROUP BY a.id, a.account_number, a.account_name, a.balance
ORDER BY a.account_number;
