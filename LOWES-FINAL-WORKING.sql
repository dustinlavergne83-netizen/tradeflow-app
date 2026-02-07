-- FINAL WORKING FIX FOR LOWES 2110
-- No complex syntax, just straightforward SQL

-- Step 1: Delete journal lines for Lowes opening balance
DELETE FROM journal_entry_lines 
WHERE entry_id IN (
  SELECT je.id FROM journal_entries je
  WHERE je.reference_type = 'opening_balance' 
  AND je.reference_id = (SELECT id FROM accounts WHERE account_number = '2110' LIMIT 1)
);

-- Step 2: Delete the opening balance journal entry for Lowes
DELETE FROM journal_entries
WHERE reference_type = 'opening_balance' 
AND reference_id = (SELECT id FROM accounts WHERE account_number = '2110' LIMIT 1);

-- Step 3: Insert new journal entry
INSERT INTO journal_entries (entry_number, entry_date, description, reference_type, reference_id, created_by, company_id, is_posted)
VALUES ('999', CURRENT_DATE, 'Opening balance', 'opening_balance', (SELECT id FROM accounts WHERE account_number = '2110' LIMIT 1), '3c75eb59-0549-46cb-b8d2-3a006a7a6c9a', '3c75eb59-0549-46cb-b8d2-3a006a7a6c9a', true);

-- Step 4: Insert the two journal lines
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
