-- =============================================
-- DELETE POSTED JOURNAL ENTRIES FOR CASH TRANSACTION
-- =============================================
-- Journal entries are being created but already marked as posted
-- Need to find and delete them so new ones can be created fresh

-- Step 1: Find journal entries marked as posted for this transaction
SELECT 
    je.id,
    je.entry_number,
    je.entry_date,
    je.description,
    je.is_posted,
    je.reference_type,
    je.reference_id,
    je.created_at
FROM journal_entries je
WHERE je.reference_type = 'bank_transaction'
  AND je.reference_id IN (
      SELECT id FROM bank_transactions 
      WHERE amount = 165.92
        AND description LIKE '%CASH%'
        AND bank_account_id = (SELECT id FROM bank_accounts WHERE account_name = 'Main Checking')
  )
ORDER BY je.created_at DESC;

-- Step 2: DELETE these journal entries (uncomment to run)
/*
DELETE FROM journal_entries
WHERE reference_type = 'bank_transaction'
  AND reference_id IN (
      SELECT id FROM bank_transactions 
      WHERE amount = 165.92
        AND description LIKE '%CASH%'
        AND bank_account_id = (SELECT id FROM bank_accounts WHERE account_name = 'Main Checking')
  )
RETURNING entry_number, description, is_posted;
*/

-- After deleting, uncheck and re-check the transaction to create a fresh journal entry
