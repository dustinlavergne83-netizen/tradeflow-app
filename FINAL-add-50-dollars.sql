-- ============================================
-- FINAL FIX: Add $50 to Bank Account
-- Shows before/after and confirms it worked
-- ============================================

-- STEP 1: Show what accounts exist
SELECT 
    '=== CURRENT ACCOUNTS ===' as step,
    account_number,
    account_name,
    account_type,
    COALESCE(balance, 0) as current_balance,
    id
FROM accounts
WHERE account_name ILIKE '%checking%' OR account_name ILIKE '%bank%' OR account_number LIKE '10%'
ORDER BY account_number;

-- STEP 2: Update the balance (works for ANY "checking" or "bank" account)
UPDATE accounts 
SET balance = COALESCE(balance, 0) + 50.00
WHERE (account_name ILIKE '%HW Business Checking%' 
   OR account_name ILIKE '%checking%' 
   OR account_number = '1010')
AND company_id = (SELECT id FROM auth.users LIMIT 1);

-- STEP 3: Show the NEW balance
SELECT 
    '=== AFTER UPDATE ===' as step,
    account_number,
    account_name,
    account_type,
    COALESCE(balance, 0) as NEW_balance,
    id
FROM accounts
WHERE account_name ILIKE '%checking%' OR account_name ILIKE '%bank%' OR account_number LIKE '10%'
ORDER BY account_number;

-- STEP 4: Confirm rows affected
SELECT 
    '=== CONFIRMATION ===' as step,
    'If you see balance increased by $50 above, it worked!' as message,
    'Refresh your Chart of Accounts page to see it' as next_step;
