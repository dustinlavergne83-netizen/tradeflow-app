-- Fix: Restore all cleared owner draw transactions to ledger
-- The issue: Cleared owner draw transactions don't have a category assigned,
-- so they can't have journal entries created

-- Step 1: Find the Owner Draws account ID in Chart of Accounts
SELECT id, account_number, account_name FROM accounts 
WHERE account_name ILIKE '%owner%draw%' 
OR account_number = '3100'
LIMIT 5;

-- Step 2: Assign the Owner Draws account to all cleared owner draw transactions without a category
-- Replace 'YOUR-OWNER-DRAWS-ACCOUNT-ID' with the ID from Step 1
UPDATE bank_transactions
SET category = 'YOUR-OWNER-DRAWS-ACCOUNT-ID'
WHERE is_cleared = TRUE
  AND is_owner_draw = TRUE
  AND category IS NULL;

-- Step 3: Verify the update worked
SELECT 
  id,
  transaction_date,
  description,
  amount,
  is_cleared,
  is_owner_draw,
  category,
  draw_status
FROM bank_transactions
WHERE is_owner_draw = TRUE
ORDER BY transaction_date DESC
LIMIT 20;
