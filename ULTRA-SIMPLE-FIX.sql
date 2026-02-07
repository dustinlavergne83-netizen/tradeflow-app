-- ULTRA SIMPLE: Just fix the balances directly
UPDATE accounts SET balance = 0 WHERE account_number = '1100';
UPDATE accounts SET balance = 0 WHERE account_number = '2700';

-- Verify
SELECT account_name, account_number, balance FROM accounts WHERE account_number IN ('1100', '2700');
