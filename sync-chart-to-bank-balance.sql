-- =============================================
-- SYNC CHART OF ACCOUNTS TO BANK BALANCE
-- =============================================
-- Bank account shows $397.16 but Chart shows $231.24
-- Just manually set Chart of Accounts to match

-- Step 1: Check current balances
SELECT 
    'Bank Account' as source,
    current_balance as balance
FROM bank_accounts
WHERE account_name = 'Main Checking'
UNION ALL
SELECT 
    'Chart of Accounts',
    balance
FROM accounts
WHERE account_number = '1010';

-- Step 2: Set Chart of Accounts #1010 to match bank balance
UPDATE accounts
SET balance = (
    SELECT current_balance 
    FROM bank_accounts 
    WHERE account_name = 'Main Checking'
)
WHERE account_number = '1010';

-- Step 3: Verify they match
SELECT 
    ba.account_name,
    ba.current_balance as bank_balance,
    a.account_number,
    a.account_name as chart_account,
    a.balance as chart_balance,
    CASE 
        WHEN ba.current_balance = a.balance THEN '✓ MATCHED'
        ELSE '✗ MISMATCH'
    END as status
FROM bank_accounts ba
JOIN accounts a ON ba.chart_account_id = a.id
WHERE ba.account_name = 'Main Checking';
