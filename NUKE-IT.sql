-- DELETE ALL journal entry lines for AR and Customer Deposits
-- This will force the system to use only stored balance from database
DELETE FROM journal_entry_lines 
WHERE account_id IN (
  SELECT id FROM accounts WHERE account_number IN ('1100', '2700')
);

-- Verify
SELECT 'Deleted all journal lines for AR and Customer Deposits' as status;
SELECT COUNT(*) as remaining FROM journal_entry_lines WHERE account_id IN (SELECT id FROM accounts WHERE account_number IN ('1100', '2700'));
