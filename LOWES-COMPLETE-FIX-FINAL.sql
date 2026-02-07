-- COMPLETE LOWES FIX - RUN THIS ENTIRE SCRIPT

-- Step 1: Fix the account's normal_balance (must be 'credit' for liability)
UPDATE accounts 
SET normal_balance = 'credit'
WHERE account_number = '2110' 
AND account_type = 'Liability';

-- Step 2: Delete broken opening balance journal lines
DELETE FROM journal_entry_lines 
WHERE entry_id IN (
  SELECT je.id 
  FROM journal_entries je
  WHERE je.reference_type = 'opening_balance' 
  AND je.reference_id = (SELECT id FROM accounts WHERE account_number = '2110' LIMIT 1)
);

-- Step 3: Delete broken opening balance journal entries
DELETE FROM journal_entries
WHERE reference_type = 'opening_balance' 
AND reference_id = (SELECT id FROM accounts WHERE account_number = '2110' LIMIT 1);

-- Step 4: Create new opening balance journal entry
INSERT INTO journal_entries (entry_number, entry_date, description, reference_type, reference_id, created_by, company_id, is_posted)
VALUES ('999', CURRENT_DATE, 'Opening balance', 'opening_balance', (SELECT id FROM accounts WHERE account_number = '2110' LIMIT 1), '3c75eb59-0549-46cb-b8d2-3a006a7a6c9a', '3c75eb59-0549-46cb-b8d2-3a006a7a6c9a', true);

-- Step 5: Insert the two journal lines (Equity DEBITS, Lowes CREDITS)
INSERT INTO journal_entry_lines (entry_id, line_number, account_id, debit, credit, description)
VALUES 
(
  (SELECT id FROM journal_entries WHERE reference_type = 'opening_balance' AND reference_id = (SELECT id FROM accounts WHERE account_number = '2110' LIMIT 1) LIMIT 1),
  1,
  (SELECT id FROM accounts WHERE account_type = 'Equity' LIMIT 1),
  6311.57,
  0,
  'Opening balance funding'
),
(
  (SELECT id FROM journal_entries WHERE reference_type = 'opening_balance' AND reference_id = (SELECT id FROM accounts WHERE account_number = '2110' LIMIT 1) LIMIT 1),
  2,
  (SELECT id FROM accounts WHERE account_number = '2110' LIMIT 1),
  0,
  6311.57,
  'Lowes opening balance'
);

-- Verify the fix
SELECT 
  a.account_number, 
  a.account_name, 
  a.account_type, 
  a.normal_balance,
  (SELECT SUM(debit) - SUM(credit) FROM journal_entry_lines WHERE account_id = a.id) as calculated_balance
FROM accounts a
WHERE a.account_number = '2110';
