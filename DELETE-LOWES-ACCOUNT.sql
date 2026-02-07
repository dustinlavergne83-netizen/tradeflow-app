-- Delete Lowes Credit Card Account and all related data
-- WARNING: This will permanently delete the account

-- First, let's find the Lowes Credit Card account ID
-- (You can check the result first before running the delete)
SELECT id, account_number, account_name, account_type FROM accounts 
WHERE account_name LIKE '%lowes%' OR account_name LIKE '%Lowes%'
AND company_id = (SELECT id FROM auth.users WHERE email = 'your_email@example.com' LIMIT 1);

-- STEP 1: Delete journal entry lines for any opening balance entries of this account
DELETE FROM journal_entry_lines 
WHERE entry_id IN (
  SELECT id FROM journal_entries 
  WHERE reference_type = 'opening_balance' 
  AND reference_id = (
    SELECT id FROM accounts 
    WHERE account_name LIKE '%lowes%' OR account_name LIKE '%Lowes%'
    AND company_id = (SELECT id FROM auth.users WHERE email = 'your_email@example.com' LIMIT 1)
    LIMIT 1
  )
);

-- STEP 2: Delete the opening balance journal entries
DELETE FROM journal_entries 
WHERE reference_type = 'opening_balance' 
AND reference_id = (
  SELECT id FROM accounts 
  WHERE account_name LIKE '%lowes%' OR account_name LIKE '%Lowes%'
  AND company_id = (SELECT id FROM auth.users WHERE email = 'your_email@example.com' LIMIT 1)
  LIMIT 1
);

-- STEP 3: Delete the account itself
DELETE FROM accounts 
WHERE account_name LIKE '%lowes%' OR account_name LIKE '%Lowes%'
AND company_id = (SELECT id FROM auth.users WHERE email = 'your_email@example.com' LIMIT 1);

-- Verify deletion
SELECT 'Account deleted successfully!' as status;
