-- =============================================
-- CLEAN SLATE - DELETE ALL BANK JOURNAL ENTRIES
-- =============================================
-- User uncleared all transactions - let's delete ALL journal entries
-- and reset account balances to start fresh

-- Step 1: Check what we're about to delete
SELECT 
    COUNT(*) as total_entries,
    SUM(CASE WHEN is_posted THEN 1 ELSE 0 END) as posted_entries,
    SUM(CASE WHEN NOT is_posted THEN 1 ELSE 0 END) as unposted_entries
FROM journal_entries
WHERE reference_type = 'bank_transaction'
  AND reference_id IN (
      SELECT id FROM bank_transactions 
      WHERE bank_account_id = (SELECT id FROM bank_accounts WHERE account_name = 'Main Checking')
  );

-- Step 2: DELETE ALL journal entries for Main Checking bank transactions
DELETE FROM journal_entries
WHERE reference_type = 'bank_transaction'
  AND reference_id IN (
      SELECT id FROM bank_transactions 
      WHERE bank_account_id = (SELECT id FROM bank_accounts WHERE account_name = 'Main Checking')
  );

-- Step 3: Reset account #1010 balance to match opening balance (should be $50 for opening balance only)
UPDATE accounts
SET balance = (
    SELECT opening_balance 
    FROM bank_accounts 
    WHERE account_name = 'Main Checking'
)
WHERE account_number = '1010';

-- Step 4: Verify everything is clean
SELECT 
    'Journal Entries' as table_name,
    COUNT(*) as remaining_count
FROM journal_entries
WHERE reference_type = 'bank_transaction'
  AND reference_id IN (
      SELECT id FROM bank_transactions 
      WHERE bank_account_id = (SELECT id FROM bank_accounts WHERE account_name = 'Main Checking')
  )
UNION ALL
SELECT 
    'Account Balance',
    balance
FROM accounts
WHERE account_number = '1010';

-- Now you can check the boxes in Bank Transactions and journal entries will be created fresh!
