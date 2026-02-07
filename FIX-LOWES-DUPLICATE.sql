-- Fix for duplicate Lowes account error
-- This will delete account number 2110 (Lowes Credit Card) and all related data

-- STEP 1: Delete journal entry lines associated with account 2110
DELETE FROM journal_entry_lines 
WHERE entry_id IN (
  SELECT je.id FROM journal_entries je
  WHERE je.reference_id IN (
    SELECT id FROM accounts WHERE account_number = '2110'
  )
);

-- STEP 2: Delete journal entries for account 2110
DELETE FROM journal_entries 
WHERE reference_id IN (
  SELECT id FROM accounts WHERE account_number = '2110'
);

-- STEP 3: Delete the duplicate account
DELETE FROM accounts 
WHERE account_number = '2110';

-- Verify it's gone
SELECT 'Account 2110 deleted!' as result;
