-- Fix the normal_balance for Lowes account 2110
-- It should be 'credit' for a LIABILITY account, not 'debit'

UPDATE accounts 
SET normal_balance = 'credit'
WHERE account_number = '2110' 
AND account_type = 'Liability';

-- Verify the change
SELECT id, account_number, account_name, account_type, normal_balance, balance 
FROM accounts 
WHERE account_number = '2110';
