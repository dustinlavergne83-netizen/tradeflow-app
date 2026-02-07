-- Delete All Test Journal Entries from Bank Transactions
-- Run this in your Supabase SQL Editor

-- STEP 1: Delete all journal entry lines for bank transactions
DELETE FROM journal_entry_lines 
WHERE entry_id IN (
    SELECT id FROM journal_entries 
    WHERE reference_type = 'bank_transaction'
);

-- STEP 2: Delete all journal entry headers for bank transactions
DELETE FROM journal_entries 
WHERE reference_type = 'bank_transaction';

-- STEP 3: Manually reset your account balances to the correct amounts
-- Update these values to match what they should actually be:

-- Reset Bank Account 1010 (HW Business Checking)
-- Currently shows: $17,876.68
-- Should be: $6,729.05 (subtract the $11,147.63 that was added twice)
UPDATE accounts 
SET balance = 6729.05 
WHERE account_number = '1010';

-- Reset Accounts Receivable 1100
-- Currently shows: $1,157.00
-- Should be: $12,304.63 (add back the $11,147.63 that was subtracted)
UPDATE accounts 
SET balance = 12304.63 
WHERE account_number = '1100';

-- Reset Inventory 1200
-- Currently shows: -$11,147.63
-- Should be: $0.00 (add back the $11,147.63 that was incorrectly subtracted)
UPDATE accounts 
SET balance = 0.00 
WHERE account_number = '1200';

-- DONE! Your accounts are now clean and ready for real transactions
SELECT 
    account_number,
    account_name,
    balance
FROM accounts
WHERE account_number IN ('1010', '1100', '1200')
ORDER BY account_number;
