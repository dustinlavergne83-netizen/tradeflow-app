-- =============================================
-- FIND JOURNAL ENTRY FOR SPECIFIC CASH TRANSACTION
-- =============================================

-- Step 1: Find the $165.92 CASH bank transaction
SELECT 
    id,
    transaction_date,
    description,
    amount,
    is_cleared,
    created_at
FROM bank_transactions
WHERE amount = 165.92
  AND description LIKE '%CASH%'
  AND bank_account_id = (SELECT id FROM bank_accounts WHERE account_name = 'Main Checking')
ORDER BY created_at DESC;

-- Step 2: Find journal entries for that SPECIFIC transaction ID
-- Copy the transaction ID from Step 1 and use it below
SELECT 
    je.id,
    je.entry_number,
    je.entry_date,
    je.description,
    je.is_posted,
    je.reference_type,
    je.reference_id,
    bt.description as transaction_description,
    je.created_at
FROM journal_entries je
JOIN bank_transactions bt ON je.reference_id = bt.id
WHERE bt.amount = 165.92
  AND bt.description LIKE '%CASH%'
  AND je.reference_type = 'bank_transaction'
ORDER BY je.created_at DESC;

-- Step 3: DELETE journal entries for this specific transaction (uncomment)

DELETE FROM journal_entries
WHERE reference_type = 'bank_transaction'
  AND reference_id IN (
      SELECT id FROM bank_transactions 
      WHERE amount = 165.92
        AND description LIKE '%CASH%'
        AND bank_account_id = (SELECT id FROM bank_accounts WHERE account_name = 'Main Checking')
  )
RETURNING entry_number, description;
*/
