-- REVERT: Change normal_balance back to DEBIT for bank account
-- The original DEBIT setting was CORRECT for a bank asset account

UPDATE accounts 
SET normal_balance = 'debit'
WHERE account_number = '1010'
  AND account_name LIKE '%HW Business Checking%';

-- Verify the change:
SELECT account_number, account_name, normal_balance, balance 
FROM accounts 
WHERE account_number = '1010';
