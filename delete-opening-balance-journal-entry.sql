-- =============================================
-- DELETE OPENING BALANCE JOURNAL ENTRY
-- =============================================

-- Find and delete the journal entry for Opening Balance transaction
DELETE FROM journal_entries
WHERE reference_type = 'bank_transaction'
  AND reference_id IN (
      SELECT id FROM bank_transactions 
      WHERE description = 'Opening Balance'
        AND bank_account_id = (SELECT id FROM bank_accounts WHERE account_name = 'Main Checking')
  )
RETURNING entry_number, description;

-- Now try checking the Opening Balance transaction again in your app
