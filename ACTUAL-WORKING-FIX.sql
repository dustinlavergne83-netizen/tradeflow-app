-- DELETE old broken entries
DELETE FROM journal_entry_lines 
WHERE entry_id IN (
  SELECT je.id FROM journal_entries je
  WHERE je.reference_type = 'opening_balance' 
  AND je.reference_id = (SELECT id FROM accounts WHERE account_number = '2110' LIMIT 1)
);

DELETE FROM journal_entries 
WHERE reference_type = 'opening_balance' 
AND reference_id = (SELECT id FROM accounts WHERE account_number = '2110');

-- Get the next entry number
-- First figure out max entry_number, cast as integer
WITH next_entry_data AS (
  SELECT 
    COALESCE(MAX(CAST(entry_number AS INTEGER)), 0) + 1 as next_num,
    (SELECT id FROM accounts WHERE account_number = '2110' LIMIT 1) as lowes_id,
    (SELECT id FROM accounts WHERE account_type = 'Equity' LIMIT 1) as equity_id
)
INSERT INTO journal_entries (entry_number, entry_date, description, reference_type, reference_id, created_by, company_id, is_posted)
SELECT 
  CAST(ned.next_num AS TEXT),
  NOW()::date,
  'Opening balance',
  'opening_balance',
  ned.lowes_id,
  '3c75eb59-0549-46cb-b8d2-3a006a7a6c9a',
  '3c75eb59-0549-46cb-b8d2-3a006a7a6c9a',
  true
FROM next_entry_data ned, journal_entries
GROUP BY ned.next_num, ned.lowes_id
RETURNING id as new_entry_id;

-- Now get the entry we just created and insert lines
WITH new_entry AS (
  SELECT id FROM journal_entries 
  WHERE reference_type = 'opening_balance' 
  AND reference_id = (SELECT id FROM accounts WHERE account_number = '2110') 
  ORDER BY created_at DESC LIMIT 1
),
lowes_acct AS (
  SELECT id FROM accounts WHERE account_number = '2110' LIMIT 1
),
equity_acct AS (
  SELECT id FROM accounts WHERE account_type = 'Equity' LIMIT 1
)
INSERT INTO journal_entry_lines (entry_id, line_number, account_id, debit, credit, description)
SELECT 
  (SELECT id FROM new_entry),
  1,
  (SELECT id FROM equity_acct),
  6723.14,
  0,
  'Opening balance funding'
UNION ALL
SELECT 
  (SELECT id FROM new_entry),
  2,
  (SELECT id FROM lowes_acct),
  0,
  6723.14,
  'Lowes opening balance';
