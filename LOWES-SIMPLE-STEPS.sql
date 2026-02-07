-- LOWES CREDIT CARD FIX - SIMPLE STEP BY STEP

-- Step 1: Delete bad journal entry lines for Lowes account 2110
DELETE FROM journal_entry_lines 
WHERE entry_id IN (
  SELECT je.id FROM journal_entries je
  INNER JOIN accounts a ON je.reference_id = a.id::text
  WHERE a.account_number = '2110'
);

-- Step 2: Delete bad journal entries for Lowes account 2110  
DELETE FROM journal_entries je
WHERE je.reference_id IN (
  SELECT a.id::text FROM accounts a 
  WHERE a.account_number = '2110'
);

-- Step 3: Create correct opening balance
-- First get the account ID and company ID
SELECT id, company_id INTO TEMP lowes_info 
FROM accounts 
WHERE account_number = '2110' LIMIT 1;

-- Get an Equity account ID for balancing
SELECT id INTO TEMP equity_id
FROM accounts 
WHERE account_type = 'Equity' 
  AND company_id = (SELECT company_id FROM lowes_info LIMIT 1)
LIMIT 1;

-- Get next journal entry number
SELECT COALESCE(MAX(entry_number), 0) + 1 INTO TEMP next_num
FROM journal_entries;

-- Create the journal entry
INSERT INTO journal_entries (
  entry_number, entry_date, description, reference_type, 
  reference_id, created_by, company_id, is_posted, posted_date
)
SELECT 
  next_num,
  CURRENT_DATE,
  'Opening balance - Lowes Credit Card',
  'opening_balance',
  id::text,
  id,
  company_id,
  true,
  CURRENT_TIMESTAMP
FROM lowes_info
RETURNING id INTO TEMP entry_id;

-- Create journal entry lines
INSERT INTO journal_entry_lines (
  entry_id, line_number, account_id, debit, credit, description
)
VALUES 
  ((SELECT id FROM entry_id LIMIT 1), 1, (SELECT id FROM equity_id LIMIT 1), 6723.14, 0, 'Opening balance'),
  ((SELECT id FROM entry_id LIMIT 1), 2, (SELECT id FROM lowes_info LIMIT 1), 0, 6723.14, 'Lowes Credit Card');

DROP TABLE IF EXISTS lowes_info;
DROP TABLE IF EXISTS equity_id;
DROP TABLE IF EXISTS next_num;
DROP TABLE IF EXISTS entry_id;

SELECT 'Done!' as result;
