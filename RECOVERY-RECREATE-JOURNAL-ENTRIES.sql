-- RECOVERY: Recreate all journal entries from bank_transactions
-- This script will:
-- 1. Delete all existing journal entries
-- 2. Recreate them from bank_transactions
-- 3. Recalculate all account balances

-- Step 1: Delete all current journal entries (wiping the slate clean)
DELETE FROM journal_entry_lines;
DELETE FROM journal_entries;

-- Step 2: Get the next sequence number
SELECT SETVAL('journal_entries_entry_number_seq', (SELECT MAX(entry_number) FROM (SELECT 1) AS dummy), FALSE);

-- Step 3: Recreate journal entries for all bank transactions
-- For each cleared transaction, create the entry
INSERT INTO journal_entries (
  company_id,
  entry_number,
  entry_date,
  description,
  reference_type,
  reference_id,
  status,
  created_at,
  created_by
)
SELECT DISTINCT
  bt.company_id,
  ROW_NUMBER() OVER (PARTITION BY bt.company_id ORDER BY bt.transaction_date) as entry_number,
  bt.transaction_date,
  CONCAT('Bank: ', bt.merchant_name, ' - ', COALESCE(a.account_name, 'Unlinked')),
  'bank_transaction',
  bt.id,
  'posted',
  NOW(),
  bt.created_by
FROM bank_transactions bt
LEFT JOIN accounts a ON a.id = bt.account_id
WHERE bt.is_cleared = TRUE
ORDER BY bt.company_id, bt.transaction_date;

-- Step 4: Create journal entry lines for bank account (source)
INSERT INTO journal_entry_lines (
  entry_id,
  account_id,
  debit_amount,
  credit_amount,
  description,
  line_number
)
SELECT
  je.id,
  bt.account_id,
  CASE 
    WHEN bt.transaction_type = 'deposit' THEN bt.amount
    ELSE 0
  END as debit_amount,
  CASE 
    WHEN bt.transaction_type = 'withdrawal' THEN bt.amount
    ELSE 0
  END as credit_amount,
  CONCAT('Bank Transaction: ', bt.merchant_name),
  1
FROM journal_entries je
JOIN bank_transactions bt ON bt.id = je.reference_id
WHERE je.reference_type = 'bank_transaction'
AND je.status = 'posted';

-- Step 5: Create journal entry lines for offset account (category)
-- This assumes each bank transaction should hit an expense or liability account
INSERT INTO journal_entry_lines (
  entry_id,
  account_id,
  debit_amount,
  credit_amount,
  description,
  line_number
)
SELECT
  je.id,
  COALESCE(bt.category_account_id, a.id), -- Use category if available, else use linked account
  CASE 
    WHEN bt.transaction_type = 'withdrawal' THEN bt.amount
    ELSE 0
  END as debit_amount,
  CASE 
    WHEN bt.transaction_type = 'deposit' THEN bt.amount
    ELSE 0
  END as credit_amount,
  CONCAT('Category: ', COALESCE(acct.account_name, 'Unlinked')),
  2
FROM journal_entries je
JOIN bank_transactions bt ON bt.id = je.reference_id
LEFT JOIN accounts acct ON acct.id = COALESCE(bt.category_account_id, a.id)
JOIN accounts a ON a.id = bt.account_id
WHERE je.reference_type = 'bank_transaction'
AND je.status = 'posted'
AND COALESCE(bt.category_account_id, a.id) IS NOT NULL;

-- Step 6: Recalculate all account balances from journal entries
UPDATE accounts a
SET balance = (
  SELECT COALESCE(SUM(CASE 
    WHEN a.normal_balance = 'Debit' THEN jel.debit_amount - jel.credit_amount
    WHEN a.normal_balance = 'Credit' THEN jel.credit_amount - jel.debit_amount
    ELSE 0
  END), 0)
  FROM journal_entry_lines jel
  WHERE jel.account_id = a.id
  AND jel.entry_id IN (
    SELECT id FROM journal_entries WHERE status = 'posted'
  )
)
WHERE a.company_id = (SELECT company_id FROM bank_transactions LIMIT 1)
AND a.is_active = TRUE;

-- Verify the recovery
SELECT 'Recovery Complete - Account Balances:' as status;
SELECT account_number, account_name, account_type, normal_balance, balance 
FROM accounts 
WHERE is_active = TRUE
ORDER BY account_number;

SELECT 'Journal Entry Count:' as status, COUNT(*) as total_entries FROM journal_entries;
SELECT 'Journal Entry Lines Count:' as status, COUNT(*) as total_lines FROM journal_entry_lines;
