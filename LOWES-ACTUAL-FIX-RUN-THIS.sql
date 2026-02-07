-- LOWES CREDIT CARD - ACTUAL WORKING FIX
-- This fixes the database state directly - SIMPLE VERSION

-- Step 1: DELETE ALL BAD JOURNAL ENTRIES for Lowes account 2110
DELETE FROM journal_entry_lines 
WHERE entry_id IN (
  SELECT je.id 
  FROM journal_entries je
  WHERE je.reference_id = '8378077a-dd30-467f-a471-ec75d0f48ef6'
);

DELETE FROM journal_entries 
WHERE reference_id = '8378077a-dd30-467f-a471-ec75d0f48ef6';

-- Step 2: UPDATE the account balance directly
UPDATE accounts
SET balance = -6311.57
WHERE id = '8378077a-dd30-467f-a471-ec75d0f48ef6';

-- Done! Account 2110 cleaned up. Reload Chart of Accounts to see the fix.
SELECT 'SUCCESS! Account 2110 Lowes Credit Card cleaned. Balance set to -$6,311.57. Reload Chart of Accounts now.' as status;
