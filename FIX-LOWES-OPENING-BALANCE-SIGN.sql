-- Fix Lowes opening balance sign
-- For a LIABILITY account, amounts owed should be NEGATIVE

UPDATE accounts
SET opening_balance = -ABS(opening_balance)
WHERE account_number = '2110'
  AND account_type = 'Liability';

-- Verify the update
SELECT id, account_number, account_name, account_type, normal_balance, opening_balance
FROM accounts 
WHERE account_number = '2110';
