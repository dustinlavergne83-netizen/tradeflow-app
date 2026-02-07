-- CLEAN SIMPLE FIX FOR LOWES 2110
-- This deletes the broken opening balance and creates a new correct one

-- DELETE STEP 1: Remove all journal lines for Lowes opening balance
DELETE FROM journal_entry_lines 
WHERE entry_id IN (
  SELECT je.id 
  FROM journal_entries je
  JOIN accounts a ON je.reference_id = a.id
  WHERE je.reference_type = 'opening_balance' 
  AND a.account_number = '2110'
);

-- DELETE STEP 2: Remove the journal entry itself
DELETE FROM journal_entries je
USING accounts a
WHERE je.reference_type = 'opening_balance' 
AND je.reference_id = a.id
AND a.account_number = '2110';

-- CREATE STEP 1: Get IDs we need
-- Lowes account ID: 9e2c1f50-b29c-4051-b2db-fa7a1ccfc8f5
-- Equity account ID: (SELECT id FROM accounts WHERE account_type = 'Equity' LIMIT 1)
-- Next entry number: 999 (use fixed number to avoid type issues)

-- INSERT journal entry
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
  '999',
  NOW()::date,
  'Opening balance - Lowes Credit Card',
  'opening_balance',
  '9e2c1f50-b29c-4051-b2db-fa7a1ccfc8f5',
  '3c75eb59-0549-46cb-b8d2-3a006a7a6c9a',
  '3c75eb59-0549-46cb-b8d2-3a006a7a6c9a',
  true
) RETURNING id INTO entry_id;

-- GET the entry ID we just created to use in next insert
-- Since we can't use RETURNING easily, we'll select by reference
-- INSERT the two journal lines

INSERT INTO journal_entry_lines (entry_id, line_number, account_id, debit, credit, description)
SELECT 
  (SELECT id FROM journal_entries WHERE reference_type = 'opening_balance' AND reference_id = '9e2c1f50-b29c-4051-b2db-fa7a1ccfc8f5' LIMIT 1),
  1,
  (SELECT id FROM accounts WHERE account_type = 'Equity' LIMIT 1),
  6723.14,
  0,
  'Opening balance funding'

UNION ALL

SELECT
  (SELECT id FROM journal_entries WHERE reference_type = 'opening_balance' AND reference_id = '9e2c1f50-b29c-4051-b2db-fa7a1ccfc8f5' LIMIT 1),
  2,
  '9e2c1f50-b29c-4051-b2db-fa7a1ccfc8f5',
  0,
  6723.14,
  'Lowes opening balance';
