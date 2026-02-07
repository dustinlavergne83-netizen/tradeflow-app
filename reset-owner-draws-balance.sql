-- ====================================
-- RESET OWNER DRAWS ACCOUNT BALANCE
-- ====================================
-- This script resets the Owner Draws account balance to match actual journal entries

-- Step 1: Find the Owner Draws account
SELECT 
    id,
    account_name,
    account_type,
    balance,
    normal_balance
FROM accounts
WHERE account_name ILIKE '%owner%draw%'
   OR account_name ILIKE '%owner%distribution%';

-- Step 2: Calculate the correct balance from journal entries
WITH owner_draws_account AS (
    SELECT id
    FROM accounts
    WHERE account_name ILIKE '%owner%draw%'
       OR account_name ILIKE '%owner%distribution%'
    LIMIT 1
),
calculated_balance AS (
    SELECT 
        COALESCE(SUM(
            CASE 
                -- Owner Draws is typically a debit account (increases with debits)
                WHEN jel.account_id = (SELECT id FROM owner_draws_account) AND jel.debit_amount IS NOT NULL 
                    THEN jel.debit_amount
                WHEN jel.account_id = (SELECT id FROM owner_draws_account) AND jel.credit_amount IS NOT NULL 
                    THEN -jel.credit_amount
                ELSE 0
            END
        ), 0) as correct_balance
    FROM journal_entry_lines jel
    INNER JOIN journal_entries je ON jel.journal_entry_id = je.id
    WHERE jel.account_id = (SELECT id FROM owner_draws_account)
)
SELECT 
    a.account_name,
    a.balance as current_balance,
    cb.correct_balance,
    (cb.correct_balance - a.balance) as difference
FROM accounts a
CROSS JOIN calculated_balance cb
WHERE a.id = (SELECT id FROM owner_draws_account);

-- Step 3: UPDATE the balance (uncomment to execute)
-- WARNING: This will overwrite the current balance!

/*
WITH owner_draws_account AS (
    SELECT id
    FROM accounts
    WHERE account_name ILIKE '%owner%draw%'
       OR account_name ILIKE '%owner%distribution%'
    LIMIT 1
),
calculated_balance AS (
    SELECT 
        COALESCE(SUM(
            CASE 
                WHEN jel.account_id = (SELECT id FROM owner_draws_account) AND jel.debit_amount IS NOT NULL 
                    THEN jel.debit_amount
                WHEN jel.account_id = (SELECT id FROM owner_draws_account) AND jel.credit_amount IS NOT NULL 
                    THEN -jel.credit_amount
                ELSE 0
            END
        ), 0) as correct_balance
    FROM journal_entry_lines jel
    INNER JOIN journal_entries je ON jel.journal_entry_id = je.id
    WHERE jel.account_id = (SELECT id FROM owner_draws_account)
)
UPDATE accounts
SET balance = (SELECT correct_balance FROM calculated_balance),
    updated_at = NOW()
WHERE id = (SELECT id FROM owner_draws_account)
RETURNING 
    account_name,
    balance as new_balance,
    updated_at;
*/

-- Step 4: Alternative - Set to zero (uncomment to execute)
-- This sets the balance to exactly 0

/*
UPDATE accounts
SET balance = 0,
    updated_at = NOW()
WHERE account_name ILIKE '%owner%draw%'
   OR account_name ILIKE '%owner%distribution%'
RETURNING 
    account_name,
    balance as new_balance,
    updated_at;
*/

-- Step 5: Verify the update worked
/*
SELECT 
    account_name,
    account_type,
    balance,
    normal_balance,
    updated_at
FROM accounts
WHERE account_name ILIKE '%owner%draw%'
   OR account_name ILIKE '%owner%distribution%';
*/
