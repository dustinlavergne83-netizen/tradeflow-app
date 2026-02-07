-- The account #1010 exists with $50 balance, but UI shows $0
-- This means the account doesn't have the right company_id set
-- The UI filters by company_id to show only YOUR accounts

-- Step 1: Check current company_id on account 1010
SELECT 
    account_number,
    account_name,
    balance,
    company_id,
    'Current company_id' as note
FROM accounts
WHERE account_number = '1010';

-- Step 2: Get YOUR user ID (company_id should match this)
SELECT 
    id as your_user_id,
    email,
    'This is YOUR user ID - company_id should match this' as note
FROM auth.users
LIMIT 1;

-- Step 3: Update account 1010 to have YOUR company_id
-- Replace 'YOUR_USER_ID_HERE' with the ID from step 2
UPDATE accounts
SET company_id = (SELECT id FROM auth.users LIMIT 1)
WHERE account_number = '1010';

-- Step 4: Verify it's fixed
SELECT 
    account_number,
    account_name,
    balance,
    company_id,
    'Updated - should now show in UI' as note
FROM accounts
WHERE account_number = '1010';
