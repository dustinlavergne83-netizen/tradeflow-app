-- Find all accounts with number 1010
SELECT 
    id,
    account_number,
    account_name,
    account_type,
    balance,
    created_at
FROM accounts
WHERE account_number = '1010'
ORDER BY created_at;

-- Which one is linked to the bank account?
SELECT 
    ba.id as bank_id,
    ba.account_name as bank_name,
    ba.chart_account_id,
    a.account_number,
    a.account_name,
    a.balance
FROM bank_accounts ba
LEFT JOIN accounts a ON ba.chart_account_id = a.id
WHERE ba.account_name = 'Main Checking';

-- Delete the duplicate (uncomment after identifying which to delete)

DELETE FROM accounts 
WHERE account_number = '1010' 
  AND id = 'PA387b0aac-6a39-40f3-9a9f-a9bd38e81133';

