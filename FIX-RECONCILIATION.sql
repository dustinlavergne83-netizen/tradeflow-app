-- Step 1: FIRST, run this to find the transaction and see its current status
SELECT 
  id,
  bank_account_id,
  transaction_date,
  description,
  amount,
  is_cleared,
  is_reconciled
FROM bank_transactions
WHERE ABS(amount) = 11147.63
ORDER BY transaction_date DESC;

-- Step 2: Once you confirm that's the right transaction, run BOTH of these to fix it:

-- This one makes sure it's marked as cleared
UPDATE bank_transactions
SET is_cleared = true
WHERE ABS(amount) = 11147.63;

-- This one makes it show up in Bank Reconciliation (is_reconciled = false means it NEEDS TO BE reconciled)
UPDATE bank_transactions
SET is_reconciled = false
WHERE ABS(amount) = 11147.63;

-- Step 3: Run this to verify it worked
SELECT 
  id,
  transaction_date,
  description,
  amount,
  is_cleared,
  is_reconciled
FROM bank_transactions
WHERE ABS(amount) = 11147.63;
