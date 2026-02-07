-- Check if you have Income and Expense accounts
SELECT 
  id,
  account_number,
  account_name,
  account_type,
  balance
FROM accounts
WHERE account_type IN ('Income', 'Expense')
ORDER BY account_type, account_number;
