-- Check what revenue accounts exist
SELECT 
    id,
    account_number,
    account_name,
    account_type,
    balance
FROM accounts
WHERE account_type = 'revenue' OR account_number LIKE '4%'
ORDER BY account_number;

-- If none exist, we need to create one
-- Uncomment below to create a basic revenue account:
/*
INSERT INTO accounts (account_number, account_name, account_type, normal_balance, balance)
VALUES ('4000', 'Sales Revenue', 'revenue', 'credit', 0)
RETURNING id, account_number, account_name;
*/
