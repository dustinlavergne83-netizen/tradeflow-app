-- DELETE all existing opening balance entries for Lowes
DELETE FROM journal_entry_lines 
WHERE entry_id IN (
  SELECT je.id FROM journal_entries je
  WHERE je.reference_type = 'opening_balance' 
  AND je.reference_id = (SELECT id FROM accounts WHERE account_number = '2110' LIMIT 1)
);

DELETE FROM journal_entries 
WHERE reference_type = 'opening_balance' 
AND reference_id = (SELECT id FROM accounts WHERE account_number = '2110' LIMIT 1);

-- CREATE FRESH ENTRY WITH CORRECT DEBITS/CREDITS
-- For a CREDIT-BALANCE account (LIABILITY):
-- Line 1: Equity DEBITS $6,723.14 (the funding source)
-- Line 2: Lowes CREDITS $6,723.14 (the liability - must be CREDIT for liability!)

WITH lowes AS (SELECT id FROM accounts WHERE account_number = '2110' LIMIT 1),
equity AS (SELECT id FROM accounts WHERE account_type = 'Equity' LIMIT 1),
next_num AS (SELECT COALESCE(MAX(entry_number), 0) + 1 as n FROM journal_entries)
INSERT INTO journal_entries (entry_number, entry_date, description, reference_type, reference_id, created_by, company_id, is_posted)
SELECT n.n, CURRENT_DATE, 'Opening balance', 'opening_balance', l.id, '3c75eb59-0549-46cb-b8d2-3a006a7a6c9a', '3c75eb59-0549-46cb-b8d2-3a006a7a6c9a', true
FROM next_num n, lowes l
RETURNING id as new_entry_id;

-- GET THE NEW ENTRY ID AND INSERT LINES
INSERT INTO journal_entry_lines (entry_id, line_number, account_id, debit, credit, description)
SELECT 
  (SELECT id FROM journal_entries WHERE reference_type = 'opening_balance' AND reference_id = (SELECT id FROM accounts WHERE account_number = '2110' LIMIT 1) ORDER BY created_at DESC LIMIT 1),
  1,
  (SELECT id FROM accounts WHERE account_type = 'Equity' LIMIT 1),
  6723.14,
  0,
  'Opening balance - Equity funding'

UNION ALL

SELECT 
  (SELECT id FROM journal_entries WHERE reference_type = 'opening_balance' AND reference_id = (SELECT id FROM accounts WHERE account_number = '2110' LIMIT 1) ORDER BY created_at DESC LIMIT 1),
  2,
  (SELECT id FROM accounts WHERE account_number = '2110' LIMIT 1),
  0,
  6723.14,
  'Opening balance - Lowes liability (CREDIT for liability account!)';
