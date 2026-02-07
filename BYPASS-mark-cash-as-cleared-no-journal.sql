-- =============================================
-- BYPASS JOURNAL ENTRIES - JUST MARK AS CLEARED
-- =============================================
-- The journal entry system is broken for this transaction
-- Just mark it as cleared manually and skip journal entries

-- Step 1: Find the transaction
SELECT 
    id,
    transaction_date,
    description,
    amount,
    is_cleared
FROM bank_transactions
WHERE amount = 165.92
  AND description LIKE '%CASH%'
  AND bank_account_id = (SELECT id FROM bank_accounts WHERE account_name = 'Main Checking');

-- Step 2: Mark it as cleared (uncomment to run)
/*
UPDATE bank_transactions
SET is_cleared = true
WHERE amount = 165.92
  AND description LIKE '%CASH%'
  AND bank_account_id = (SELECT id FROM bank_accounts WHERE account_name = 'Main Checking');
*/

-- That's it. No journal entries. Just marked as cleared.
-- You can create journal entries manually later if needed.
