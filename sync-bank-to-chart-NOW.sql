-- Sync Chart of Accounts #1010 balance with Main Checking bank account balance

-- Step 1: Check current balances
SELECT 
    'Bank Account' as source,
    current_balance as balance
FROM bank_accounts
WHERE account_name = 'Main Checking';

SELECT 
    'Chart of Accounts' as source,
    balance
FROM accounts
WHERE account_number = '1010';

-- Step 2: UPDATE Chart of Accounts to match Bank Account
UPDATE accounts
SET balance = (
    SELECT current_balance
    FROM bank_accounts
    WHERE account_name = 'Main Checking'
    LIMIT 1
)
WHERE account_number = '1010';

-- Step 3: Verify they match now
SELECT 
    'AFTER UPDATE - Bank Account' as source,
    current_balance as balance
FROM bank_accounts
WHERE account_name = 'Main Checking';

SELECT 
    'AFTER UPDATE - Chart #1010' as source,
    balance
FROM accounts
WHERE account_number = '1010';
