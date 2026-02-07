-- SIMPLE FIX FOR LOWES OPENING BALANCE
-- Delete old broken entries
DELETE FROM journal_entry_lines 
WHERE entry_id IN (
  SELECT je.id FROM journal_entries je
  WHERE je.reference_type = 'opening_balance' 
  AND je.reference_id = (SELECT id FROM accounts WHERE account_number = '2110' LIMIT 1)
);

DELETE FROM journal_entries 
WHERE reference_type = 'opening_balance' 
AND reference_id = (SELECT id FROM accounts WHERE account_number = '2110');

-- Get the data we need
-- Lowes account ID
SELECT id as lowes_id FROM accounts WHERE account_number = '2110' LIMIT 1 INTO lowes_id;

-- Equity account ID  
SELECT id as equity_id FROM accounts WHERE account_type = 'Equity' LIMIT 1 INTO equity_id;

-- Next entry number
SELECT COALESCE(MAX(CAST(entry_number AS INTEGER)), 0) + 1 as next_num 
FROM journal_entries INTO next_entry_num;

-- Create new journal entry
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
  next_entry_num::text,
  CURRENT_DATE,
  'Opening balance',
  'opening_balance',
  lowes_id,
  '3c75eb59-0549-46cb-b8d2-3a006a7a6c9a',
  '3c75eb59-0549-46cb-b8d2-3a006a7a6c9a',
  true
) RETURNING id INTO new_entry_id;

-- Insert the two lines
INSERT INTO journal_entry_lines (entry_id, line_number, account_id, debit, credit, description)
VALUES 
  (new_entry_id, 1, equity_id, 6723.14, 0, 'Opening balance funding'),
  (new_entry_id, 2, lowes_id, 0, 6723.14, 'Opening balance - Lowes liability');
