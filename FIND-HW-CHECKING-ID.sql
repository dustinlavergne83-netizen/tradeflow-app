-- First, let's find the actual HW Checking Account ID
SELECT id, account_name, account_type FROM bank_accounts 
WHERE account_name ILIKE '%checking%' OR account_name ILIKE '%hw%' OR account_name ILIKE '%hardware%'
ORDER BY account_name;
