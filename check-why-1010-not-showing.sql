-- Account 1010 has correct company_id and balance but NOT showing in UI
-- Check if it's marked inactive or RLS is blocking it

-- Step 1: Check ALL fields on account 1010
SELECT *
FROM accounts
WHERE account_number = '1010';

-- Step 2: Check if there's an is_active field that's false
SELECT 
    account_number,
    account_name,
    balance,
    CASE 
        WHEN is_active = true THEN 'ACTIVE'
        WHEN is_active = false THEN 'INACTIVE - THIS IS THE PROBLEM'
        WHEN is_active IS NULL THEN 'NULL'
    END as active_status
FROM accounts
WHERE account_number = '1010';

-- Step 3: FIX IT - Set is_active = true
UPDATE accounts
SET is_active = true
WHERE account_number = '1010';

-- Step 4: Verify
SELECT 
    account_number,
    account_name,
    balance,
    company_id,
    is_active,
    'FIXED - should now show' as note
FROM accounts
WHERE account_number = '1010';
