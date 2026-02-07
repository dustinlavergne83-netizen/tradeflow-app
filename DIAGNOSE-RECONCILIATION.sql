-- Find the $11,147.63 transaction and see why it's not showing in Bank Reconciliation
SELECT 
  id,
  bank_account_id,
  transaction_date,
  description,
  amount,
  is_cleared,
  is_reconciled,
  reconciled_at,
  reconciled_by,
  created_at
FROM bank_transactions
WHERE ABS(amount) = 11147.63
ORDER BY transaction_date DESC;

-- Also check the bank account to see if there are any issues
SELECT 
  id,
  account_name,
  bank_name,
  current_balance,
  opening_balance,
  last_reconciled_balance,
  last_reconciled_date
FROM bank_accounts
ORDER BY created_at DESC
LIMIT 5;

-- Count how many unreconciled transactions exist total
SELECT COUNT(*) as unreconciled_count
FROM bank_transactions
WHERE is_reconciled = false;
