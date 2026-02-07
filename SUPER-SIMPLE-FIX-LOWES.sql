-- SUPER SIMPLE FIX - RUN THIS IN SUPABASE SQL EDITOR
-- Step 1: Delete the broken opening balance entries
DELETE FROM journal_entry_lines 
WHERE entry_id IN (
  SELECT je.id FROM journal_entries je
  WHERE je.reference_type = 'opening_balance' 
  AND je.reference_id = (SELECT id FROM accounts WHERE account_number = '2110' LIMIT 1)
);

DELETE FROM journal_entries 
WHERE reference_type = 'opening_balance' 
AND reference_id = (SELECT id FROM accounts WHERE account_number = '2110');

-- Step 2: Create a fresh opening balance entry
INSERT INTO journal_entries (
  entry_number, 
  entry_date, 
  description, 
  reference_type, 
  reference_id, 
  created_by, 
  company_id, 
  is_posted
) VALUES (
  (SELECT COALESCE(MAX(entry_number), 0) + 1 FROM journal_entries)::text,
  NOW()::date,
  'Opening balance - Lowes Credit Card',
  'opening_balance',
  (SELECT id FROM accounts WHERE account_number = '2110' LIMIT 1),
  '3c75eb59-0549-46cb-b8d2-3a006a7a6c9a',
  '3c75eb59-0549-46cb-b8d2-3a006a7a6c9a',
  true
);

-- Step 3: Insert the two journal lines
INSERT INTO journal_entry_lines (entry_id, line_number, account_id, debit, credit, description)
SELECT 
  (SELECT id FROM journal_entries WHERE reference_type = 'opening_balance' AND reference_id = (SELECT id FROM accounts WHERE account_number = '2110') ORDER BY created_at DESC LIMIT 1),
  1,
  (SELECT id FROM accounts WHERE account_type = 'Equity' LIMIT 1),
  6723.14,
  0,
  'Opening balance funding from equity'
UNION ALL
SELECT 
  (SELECT id FROM journal_entries WHERE reference_type = 'opening_balance' AND reference_id = (SELECT id FROM accounts WHERE account_number = '2110') ORDER BY created_at DESC LIMIT 1),
  2,
  (SELECT id FROM accounts WHERE account_number = '2110' LIMIT 1),
  0,
  6723.14,
  'Lowes Credit Card opening balance';
