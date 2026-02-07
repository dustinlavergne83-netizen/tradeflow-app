-- Fix account #1010 to use YOUR actual user ID
-- Step 1: First, find YOUR user ID by looking at YOUR other accounts
SELECT DISTINCT
    company_id as your_actual_user_id,
    'This is YOUR user ID (from your other accounts)' as note
FROM accounts
WHERE account_number IN ('1100', '1020', '1000')  -- Looking at other accounts you can see
  AND company_id IS NOT NULL
LIMIT 1;

-- Step 2: Check what company_id account 1010 currently has
SELECT 
    account_number,
    account_name,
    balance,
    company_id as current_company_id,
    'Account 1010 current state' as note
FROM accounts
WHERE account_number = '1010';

-- Step 3: Update account 1010 to match YOUR company_id (from your other accounts)
UPDATE accounts
SET company_id = (
    SELECT DISTINCT company_id
    FROM accounts
    WHERE account_number IN ('1100', '1020', '1000')
      AND company_id IS NOT NULL
    LIMIT 1
)
WHERE account_number = '1010';

-- Step 4: Verify it worked
SELECT 
    account_number,
    account_name,
    balance,
    company_id,
    'FIXED - should now show in UI' as note
FROM accounts
WHERE account_number = '1010';
