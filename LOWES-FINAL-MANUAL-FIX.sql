-- ============================================
-- LOWES CREDIT CARD - MANUAL FIX (NO COMPLEX SYNTAX)
-- ============================================
-- Run these 3 queries ONE AT A TIME in Supabase SQL Editor

-- QUERY 1: Get the Lowes account ID (run this first, copy the ID)
SELECT id, account_number, company_id
FROM accounts 
WHERE account_number = '2110';

-- QUERY 2: Delete bad journal entries (paste the ID from Query 1 into both places below)
-- Replace 'PASTE_LOWES_ACCOUNT_ID_HERE' with the actual ID from Query 1
DELETE FROM journal_entry_lines 
WHERE entry_id IN (
  SELECT id FROM journal_entries 
  WHERE reference_id = '8378077a-dd30-467f-a471-ec75d0f48ef6'
);

DELETE FROM journal_entries 
WHERE reference_id = '8378077a-dd30-467f-a471-ec75d0f48ef6';

-- QUERY 3: Get Equity account ID (run this, copy the ID)
-- Replace 'PASTE_COMPANY_ID_HERE' with the company_id from Query 1
SELECT id FROM accounts 
WHERE company_id = '3c75eb59-0549-46cb-b8d2-3a006a7a6c9a'
  AND account_type = 'Equity'
LIMIT 1;

-- QUERY 4: Get next journal entry number
SELECT COALESCE(MAX(entry_number), 0) + 1 as next_number
FROM journal_entries;

-- QUERY 5: Create opening balance journal entry
-- Replace: 'NEXT_ENTRY_NUMBER', 'EQUITY_ACCOUNT_ID', 'LOWES_ACCOUNT_ID', 'CREATED_BY_USER_ID'
INSERT INTO journal_entries (
  entry_number, 
  entry_date, 
  description, 
  reference_type, 
  reference_id, 
  created_by, 
  company_id,
  is_posted
)
VALUES (
  NEXT_ENTRY_NUMBER,
  CURRENT_DATE,
  'Opening balance - Lowes Credit Card',
  'opening_balance',
  'LOWES_ACCOUNT_ID',
  'CREATED_BY_USER_ID',
  'PASTE_COMPANY_ID_HERE',
  true
);

-- QUERY 6: Create journal entry lines
-- Replace entry_id with the ID returned from QUERY 5, use equity ID and lowes ID
INSERT INTO journal_entry_lines (
  entry_id, 
  line_number, 
  account_id, 
  debit, 
  credit, 
  description
)
VALUES 
  ('ENTRY_ID_FROM_QUERY_5', 1, 'EQUITY_ACCOUNT_ID', 6723.14, 0, 'Opening balance'),
  ('ENTRY_ID_FROM_QUERY_5', 2, 'LOWES_ACCOUNT_ID', 0, 6723.14, 'Lowes Credit Card liability');

-- ============================================
-- EXAMPLE (with made-up IDs):
-- ============================================
-- Query 1 gave us:
--   id: 12345678-1234-1234-1234-123456789012
--   company_id: abcdefgh-abcd-abcd-abcd-abcdefghijkl
--
-- Query 3 gave us Equity account ID:
--   id: 87654321-4321-4321-4321-210987654321
--
-- Query 4 gave us next entry number: 42
--
-- Query 5 INSERT returned ID: 55555555-5555-5555-5555-555555555555
--
-- So Query 6 would be:
-- INSERT INTO journal_entry_lines (
--   entry_id, line_number, account_id, debit, credit, description
-- )
-- VALUES 
--   ('55555555-5555-5555-5555-555555555555', 1, '87654321-4321-4321-4321-210987654321', 6723.14, 0, 'Opening balance'),
--   ('55555555-5555-5555-5555-555555555555', 2, '12345678-1234-1234-1234-123456789012', 0, 6723.14, 'Lowes Credit Card liability');
