-- FINAL CORRECT RECOVERY - WITH RIGHT COLUMN NAMES
-- Based on actual schema: debit/credit not debit_amount/credit_amount

-- Step 1: Delete corrupted entries
DELETE FROM journal_entry_lines;
DELETE FROM journal_entries;

-- Step 2: Recreate journal entries from bank transactions
INSERT INTO journal_entries (
  company_id,
  entry_number,
  entry_date,
  description,
  reference_type,
  reference_id,
  is_posted,
  posted_at,
  posted_by,
  created_at,
  created_by
)
SELECT DISTINCT
  a.company_id,
  ROW_NUMBER() OVER (PARTITION BY a.company_id ORDER BY bt.transaction_date)::text,
  bt.transaction_date,
  CONCAT('Bank: ', COALESCE(bt.payee, bt.description)),
  'bank_transaction',
  bt.id,
  TRUE,
  NOW(),
  bt.created_by,
  NOW(),
  bt.created_by
FROM bank_transactions bt
JOIN accounts a ON a.id = bt.bank_account_id
WHERE bt.is_cleared = TRUE
ORDER BY a.company_id, bt.transaction_date;

-- Step 3: Create journal entry lines for bank account
INSERT INTO journal_entry_lines (
  entry_id,
  account_id,
  line_number,
  debit,
  credit,
  description,
  created_at
)
SELECT
  je.id,
  bt.bank_account_id,
  1,
  CASE WHEN bt.transaction_type = 'deposit' THEN bt.amount ELSE 0 END,
  CASE WHEN bt.transaction_type = 'withdrawal' THEN bt.amount ELSE 0 END,
  CONCAT('Bank: ', COALESCE(bt.payee, bt.description)),
  NOW()
FROM journal_entries je
JOIN bank_transactions bt ON bt.id = je.reference_id
WHERE je.reference_type = 'bank_transaction'
AND je.is_posted = TRUE;

-- Step 4: Create offset entries for linked expenses
INSERT INTO journal_entry_lines (
  entry_id,
  account_id,
  line_number,
  debit,
  credit,
  description,
  created_at
)
SELECT
  je.id,
  e.account_id,
  2,
  CASE WHEN bt.transaction_type = 'withdrawal' THEN bt.amount ELSE 0 END,
  CASE WHEN bt.transaction_type = 'deposit' THEN bt.amount ELSE 0 END,
  CONCAT('Expense: ', COALESCE(a2.account_name, 'Unlinked')),
  NOW()
FROM journal_entries je
JOIN bank_transactions bt ON bt.id = je.reference_id
LEFT JOIN expenses e ON e.id = bt.linked_expense_id
LEFT JOIN accounts a2 ON a2.id = e.account_id
WHERE je.reference_type = 'bank_transaction'
AND je.is_posted = TRUE
AND e.account_id IS NOT NULL;

-- Step 5: For unlinked transactions, create offset to default expense account
INSERT INTO journal_entry_lines (
  entry_id,
  account_id,
  line_number,
  debit,
  credit,
  description,
  created_at
)
SELECT
  je.id,
  (SELECT id FROM accounts WHERE account_number = '6000' LIMIT 1),
  2,
  CASE WHEN bt.transaction_type = 'withdrawal' THEN bt.amount ELSE 0 END,
  CASE WHEN bt.transaction_type = 'deposit' THEN bt.amount ELSE 0 END,
  CONCAT('Uncategorized: ', COALESCE(bt.category, 'Other')),
  NOW()
FROM journal_entries je
JOIN bank_transactions bt ON bt.id = je.reference_id
WHERE je.reference_type = 'bank_transaction'
AND je.is_posted = TRUE
AND NOT EXISTS (
  SELECT 1 FROM journal_entry_lines jel 
  WHERE jel.entry_id = je.id AND jel.line_number = 2
);

-- Step 6: Recalculate account balances
UPDATE accounts a
SET balance = (
  SELECT COALESCE(SUM(CASE 
    WHEN a.normal_balance = 'Debit' THEN jel.debit - jel.credit
    WHEN a.normal_balance = 'Credit' THEN jel.credit - jel.debit
    ELSE 0
  END), 0)
  FROM journal_entry_lines jel
  WHERE jel.account_id = a.id
  AND jel.entry_id IN (SELECT id FROM journal_entries WHERE is_posted = TRUE)
);

-- Verify
SELECT 'RECOVERY COMPLETE' as status;
SELECT COUNT(*) as entry_count FROM journal_entries;
SELECT COUNT(*) as line_count FROM journal_entry_lines;
SELECT account_number, account_name, account_type, normal_balance, balance 
FROM accounts WHERE is_active = TRUE ORDER BY account_number;
