-- CREATE OPENING BALANCE JOURNAL ENTRY FOR LOWES ACCOUNT 2110
-- This creates the proper journal entry for the -$6,311.57 opening balance

-- Get the Lowes account ID and details
WITH lowes_account AS (
  SELECT id, account_number, normal_balance 
  FROM accounts 
  WHERE account_number = '2110' 
  AND account_name = 'Lowes Credit Card'
  LIMIT 1
),
equity_account AS (
  SELECT id FROM accounts 
  WHERE account_type = 'Equity' 
  LIMIT 1
),
next_entry_number AS (
  SELECT COALESCE(MAX(entry_number), 0) + 1 as num 
  FROM journal_entries
)
-- CREATE THE JOURNAL ENTRY
INSERT INTO journal_entries (entry_number, entry_date, description, reference_type, reference_id, created_by, company_id, is_posted)
SELECT 
  n.num,
  CURRENT_DATE,
  'Opening balance - Lowes Credit Card 2110',
  'opening_balance',
  la.id,
  '3c75eb59-0549-46cb-b8d2-3a006a7a6c9a',
  '3c75eb59-0549-46cb-b8d2-3a006a7a6c9a',
  true
FROM next_entry_number n, lowes_account la
WHERE NOT EXISTS (
  SELECT 1 FROM journal_entries 
  WHERE reference_type = 'opening_balance' 
  AND reference_id = la.id
)
RETURNING id INTO entry_id;

-- CREATE JOURNAL ENTRY LINES
-- Line 1: Credit Equity account for $6,311.57
INSERT INTO journal_entry_lines (entry_id, line_number, account_id, debit, credit, description)
SELECT 
  (SELECT id FROM journal_entries WHERE reference_type = 'opening_balance' AND reference_id = (SELECT id FROM accounts WHERE account_number = '2110') LIMIT 1),
  1,
  ea.id,
  6311.57,
  0,
  'Opening balance funding'
FROM equity_account ea;

-- Line 2: Credit Lowes account for $6,311.57 (liability increases with credit)
INSERT INTO journal_entry_lines (entry_id, line_number, account_id, debit, credit, description)
SELECT 
  (SELECT id FROM journal_entries WHERE reference_type = 'opening_balance' AND reference_id = (SELECT id FROM accounts WHERE account_number = '2110') LIMIT 1),
  2,
  (SELECT id FROM accounts WHERE account_number = '2110' LIMIT 1),
  0,
  6311.57,
  'Opening balance - Lowes Credit Card liability'
FROM lowes_account;

SELECT 'Opening balance journal entry created for Lowes 2110!' as status;
