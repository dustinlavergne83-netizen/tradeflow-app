-- Step 1: Delete all opening balance journal lines for Lowes 2110
DELETE FROM journal_entry_lines 
WHERE entry_id IN (
  SELECT je.id FROM journal_entries je
  WHERE je.reference_type = 'opening_balance' 
  AND je.reference_id = (SELECT id FROM accounts WHERE account_number = '2110' LIMIT 1)
);

-- Step 2: Delete all opening balance journal entries for Lowes 2110
DELETE FROM journal_entries 
WHERE reference_type = 'opening_balance' 
AND reference_id = (SELECT id FROM accounts WHERE account_number = '2110');

-- Step 3: Calculate next entry number safely
WITH calc AS (
  SELECT 
    (COALESCE(MAX(CAST(entry_number AS INTEGER)), 0) + 1)::TEXT AS next_entry_num
  FROM journal_entries
)
-- Step 4: Insert new journal entry
INSERT INTO journal_entries (
  entry_number, entry_date, description, reference_type, reference_id,
  created_by, company_id, is_posted
)
SELECT 
  calc.next_entry_num,
  NOW()::date,
  'Opening balance',
  'opening_balance',
  (SELECT id FROM accounts WHERE account_number = '2110' LIMIT 1),
  '3c75eb59-0549-46cb-b8d2-3a006a7a6c9a',
  '3c75eb59-0549-46cb-b8d2-3a006a7a6c9a',
  true
FROM calc;

-- Step 5: Insert the two journal lines (Equity and Lowes)
INSERT INTO journal_entry_lines (entry_id, line_number, account_id, debit, credit, description)
VALUES 
  (
    (SELECT id FROM journal_entries WHERE reference_type = 'opening_balance' AND reference_id = (SELECT id FROM accounts WHERE account_number = '2110') ORDER BY created_at DESC LIMIT 1),
    1,
    (SELECT id FROM accounts WHERE account_type = 'Equity' LIMIT 1),
    6723.14::NUMERIC,
    0::NUMERIC,
    'Opening balance funding'
  ),
  (
    (SELECT id FROM journal_entries WHERE reference_type = 'opening_balance' AND reference_id = (SELECT id FROM accounts WHERE account_number = '2110') ORDER BY created_at DESC LIMIT 1),
    2,
    (SELECT id FROM accounts WHERE account_number = '2110' LIMIT 1),
    0::NUMERIC,
    6723.14::NUMERIC,
    'Lowes opening balance'
  );
