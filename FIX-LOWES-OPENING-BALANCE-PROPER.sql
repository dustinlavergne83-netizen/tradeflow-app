-- FIX LOWES OPENING BALANCE WITH PROPER 2-LINE ENTRY
-- First, find and delete any existing opening balance entries for Lowes 2110

-- Step 1: Get the Lowes account ID
WITH lowes_data AS (
  SELECT id FROM accounts 
  WHERE account_number = '2110' AND account_name = 'Lowes Credit Card'
),
-- Step 2: Find existing opening balance journal entries for Lowes
existing_entries AS (
  SELECT je.id FROM journal_entries je
  WHERE je.reference_type = 'opening_balance' 
  AND je.reference_id = (SELECT id FROM lowes_data)
)
-- Step 3: Delete the journal lines first
DELETE FROM journal_entry_lines 
WHERE entry_id IN (SELECT id FROM existing_entries);

-- Step 4: Delete the journal entries
DELETE FROM journal_entries 
WHERE reference_type = 'opening_balance' 
AND reference_id = (
  SELECT id FROM accounts 
  WHERE account_number = '2110'
);

-- Step 5: Now create a FRESH, CORRECT opening balance entry
-- Find accounts we need
WITH lowes_id AS (
  SELECT id FROM accounts WHERE account_number = '2110' LIMIT 1
),
equity_id AS (
  SELECT id FROM accounts WHERE account_type = 'Equity' LIMIT 1
),
next_number AS (
  SELECT COALESCE(MAX(entry_number), 0) + 1 as num FROM journal_entries
),
company_user AS (
  SELECT '3c75eb59-0549-46cb-b8d2-3a006a7a6c9a' as user_id
)
-- Create the journal entry
INSERT INTO journal_entries (entry_number, entry_date, description, reference_type, reference_id, created_by, company_id, is_posted)
SELECT 
  nn.num,
  CURRENT_DATE,
  'Opening balance - Lowes Credit Card 2110',
  'opening_balance',
  li.id,
  cu.user_id,
  cu.user_id,
  true
FROM next_number nn, lowes_id li, company_user cu
RETURNING id INTO entry_id;

-- Step 6: Insert the two journal lines
-- Line 1: Equity account DEBITS $6,311.57 (funding the opening)
-- Line 2: Lowes CREDITS $6,311.57 (liability is recorded as credit)

INSERT INTO journal_entry_lines (entry_id, line_number, account_id, debit, credit, description)
SELECT 
  (SELECT id FROM journal_entries WHERE reference_type = 'opening_balance' AND reference_id = (SELECT id FROM accounts WHERE account_number = '2110') LIMIT 1),
  1,
  (SELECT id FROM accounts WHERE account_type = 'Equity' LIMIT 1),
  6311.57,
  0,
  'Opening balance funding'

UNION ALL

SELECT 
  (SELECT id FROM journal_entries WHERE reference_type = 'opening_balance' AND reference_id = (SELECT id FROM accounts WHERE account_number = '2110') LIMIT 1),
  2,
  (SELECT id FROM accounts WHERE account_number = '2110' LIMIT 1),
  0,
  6311.57,
  'Lowes Credit Card opening balance';

-- Verify the entry is balanced
SELECT 
  'Verification: Entry should be balanced' as status,
  COALESCE(SUM(CASE WHEN line_number = 1 THEN debit ELSE 0 END), 0) as line1_debit,
  COALESCE(SUM(CASE WHEN line_number = 2 THEN credit ELSE 0 END), 0) as line2_credit
FROM journal_entry_lines
WHERE entry_id = (SELECT id FROM journal_entries WHERE reference_type = 'opening_balance' AND reference_id = (SELECT id FROM accounts WHERE account_number = '2110') LIMIT 1);
