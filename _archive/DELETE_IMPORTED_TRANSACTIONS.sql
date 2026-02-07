-- Delete all imported transactions from your main checking account
-- Run this in Supabase Dashboard SQL Editor

-- OPTION 1: Delete ONLY imported transactions (those uploaded via CSV)
-- This keeps any manually entered transactions
DELETE FROM bank_transactions
WHERE imported_date IS NOT NULL
AND bank_account_id = (
  SELECT id FROM bank_accounts 
  WHERE account_name ILIKE '%checking%' 
  LIMIT 1
);

-- OPTION 2: Delete ALL transactions from checking account (imported AND manual)
-- Uncomment the lines below if you want to delete everything
/*
DELETE FROM bank_transactions
WHERE bank_account_id = (
  SELECT id FROM bank_accounts 
  WHERE account_name ILIKE '%checking%' 
  LIMIT 1
);
*/

-- OPTION 3: If you know the exact bank_account_id, use this for precision
-- Replace 'YOUR-BANK-ACCOUNT-ID-HERE' with your actual ID
/*
DELETE FROM bank_transactions
WHERE bank_account_id = 'YOUR-BANK-ACCOUNT-ID-HERE';
*/

-- To find your bank account ID first, run this:
/*
SELECT id, account_name, bank_name 
FROM bank_accounts 
ORDER BY account_name;
*/
