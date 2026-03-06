-- =============================================
-- SYNC BANK ACCOUNTS WITH CHART OF ACCOUNTS
-- =============================================
-- Problem: bank_accounts.current_balance shows $397.16
-- But Chart of Accounts (account 1010) shows $231.24
-- They should match!

-- Step 1: Check which accounts are out of sync
SELECT 
    ba.account_name as bank_account_name,
    ba.current_balance as bank_balance,
    a.account_name as chart_account_name,
    a.balance as chart_balance,
    ba.current_balance - a.balance as difference
FROM bank_accounts ba
LEFT JOIN accounts a ON ba.chart_account_id = a.id
WHERE ba.chart_account_id IS NOT NULL
ORDER BY ba.account_name;

-- Step 2: Sync Chart of Accounts to match bank account balances (uncomment to run)

UPDATE accounts a
SET balance = ba.current_balance
FROM bank_accounts ba
WHERE ba.chart_account_id = a.id
  AND ba.chart_account_id IS NOT NULL
RETURNING 
    a.account_number,
    a.account_name,
    a.balance as new_chart_balance;
*/

-- Step 3: Verify they match now

SELECT 
    ba.account_name as bank_account_name,
    ba.current_balance as bank_balance,
    a.account_name as chart_account_name,
    a.balance as chart_balance,
    CASE 
        WHEN ABS(ba.current_balance - a.balance) < 0.01 THEN '✓ Matched'
        ELSE '✗ Still Different'
    END as status
FROM bank_accounts ba
LEFT JOIN accounts a ON ba.chart_account_id = a.id
WHERE ba.chart_account_id IS NOT NULL
ORDER BY ba.account_name;
*/
