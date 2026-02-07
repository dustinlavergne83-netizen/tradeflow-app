-- Fix Lowes Credit Card account type and normal balance
-- Set it to LIABILITY with credit normal balance

UPDATE accounts
SET 
  account_type = 'Liability',
  normal_balance = 'credit'
WHERE 
  account_name ILIKE '%lowes%'
  OR account_name ILIKE '%credit card%'
  AND account_number = '2110';

-- Verify the update
SELECT id, account_number, account_name, account_type, normal_balance 
FROM accounts 
WHERE account_number = '2110' 
   OR account_name ILIKE '%lowes%';
