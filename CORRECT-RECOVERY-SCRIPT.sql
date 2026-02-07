-- CORRECT RECOVERY SCRIPT - Based on actual bank_transactions schema
-- This rebuilds journal entries from bank transactions (source of truth)

-- Step 1: Delete all corrupted journal entries and lines
DELETE FROM journal_entry_lines;
DELETE FROM journal_entries;

-- Step 2: Recreate journal entries from cleared bank transactions
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
  ROW_NUMBER() OVER (PARTITION BY a.company_id ORDER BY bt.transaction_date)::text as entry_number,
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

-- Step 3: Create journal entry lines for the bank account
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
  bt.bank_account_id,
  CASE 
    WHEN bt.transaction_type = 'deposit' THEN bt.amount
    ELSE 0
  END as debit_amount,
  CASE 
    WHEN bt.transaction_type = 'withdrawal' THEN bt.amount
    ELSE 0
  END as credit_amount,
  CONCAT('Bank: ', COALESCE(bt.payee, bt.description)),
  1
FROM journal_entries je
JOIN bank_transactions bt ON bt.id = je.reference_id
WHERE je.reference_type = 'bank_transaction'
AND je.is_posted = TRUE;

-- Step 4: Create offset entries using linked_expense_id if available
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
  e.account_id, -- Use the expense's account
  CASE 
    WHEN bt.transaction_type = 'withdrawal' THEN bt.amount
    ELSE 0
  END as debit_amount,
  CASE 
    WHEN bt.transaction_type = 'deposit' THEN bt.amount
    ELSE 0
  END as credit_amount,
  CONCAT('Expense: ', COALESCE(a2.account_name, 'Unlinked')),
  2
FROM journal_entries je
JOIN bank_transactions bt ON bt.id = je.reference_id
LEFT JOIN expenses e ON e.id = bt.linked_expense_id
LEFT JOIN accounts a2 ON a2.id = e.account_id
WHERE je.reference_type = 'bank_transaction'
AND je.is_posted = TRUE
AND e.account_id IS NOT NULL;

-- Step 5: For transactions without expense links, use category to estimate account
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
  CASE 
    -- Find an expense account that matches the category
    WHEN EXISTS (SELECT 1 FROM accounts a WHERE a.account_name ILIKE '%' || bt.category || '%' AND a.account_type = 'Expense') 
    THEN (SELECT id FROM accounts WHERE account_name ILIKE '%' || bt.category || '%' AND account_type = 'Expense' LIMIT 1)
    -- Otherwise use a default expense account
    ELSE (SELECT id FROM accounts WHERE account_number = '6000' LIMIT 1)
  END as account_id,
  CASE 
    WHEN bt.transaction_type = 'withdrawal' THEN bt.amount
    ELSE 0
  END as debit_amount,
  CASE 
    WHEN bt.transaction_type = 'deposit' THEN bt.amount
    ELSE 0
  END as credit_amount,
  CONCAT('Category: ', COALESCE(bt.category, 'Uncategorized')),
  2
FROM journal_entries je
JOIN bank_transactions bt ON bt.id = je.reference_id
WHERE je.reference_type = 'bank_transaction'
AND je.is_posted = TRUE
AND NOT EXISTS (
  SELECT 1 FROM journal_entry_lines jel 
  WHERE jel.entry_id = je.id AND jel.line_number = 2
);

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
AND jel.entry_id IN (SELECT id FROM journal_entries WHERE is_posted = TRUE)
);

-- Verify recovery
SELECT 'RECOVERY COMPLETE' as status;
SELECT COUNT(*) as journal_entry_count FROM journal_entries;
SELECT COUNT(*) as journal_line_count FROM journal_entry_lines;

-- Show account balances
SELECT 'Account Balances After Recovery:' as section;
SELECT account_number, account_name, account_type, normal_balance, balance 
FROM accounts 
WHERE is_active = TRUE
ORDER BY account_number;
