-- Set ALL bank transactions to NOT reconciled
-- This will reset the is_reconciled flag to false for all transactions
-- so you can do a fresh reconciliation

UPDATE bank_transactions
SET is_reconciled = false;

-- Verify the update - show count of not reconciled transactions
SELECT COUNT(*) as total_not_reconciled 
FROM bank_transactions 
WHERE is_reconciled = false;

-- Show count of reconciled transactions (should be 0 now)
SELECT COUNT(*) as total_reconciled 
FROM bank_transactions 
WHERE is_reconciled = true;

-- Show summary by account
SELECT 
  ba.account_name,
  COUNT(bt.id) as total_transactions,
  SUM(CASE WHEN bt.is_reconciled = false THEN 1 ELSE 0 END) as not_reconciled,
  SUM(CASE WHEN bt.is_reconciled = true THEN 1 ELSE 0 END) as reconciled
FROM bank_accounts ba
LEFT JOIN bank_transactions bt ON bt.bank_account_id = ba.id
GROUP BY ba.id, ba.account_name
ORDER BY ba.account_name;
