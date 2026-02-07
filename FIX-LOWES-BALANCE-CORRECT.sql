-- Fix Lowes Credit Card balance to be negative (LIABILITY accounts show amounts owed as negative)

UPDATE accounts
SET balance = -ABS(balance)
WHERE account_number = '2110'
  AND account_type = 'Liability';

-- Verify
SELECT account_number, account_name, account_type, normal_balance, balance
FROM accounts
WHERE account_number = '2110';
