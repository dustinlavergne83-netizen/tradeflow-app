-- FIX: Create missing journal entries for owner draws that don't have entries

-- The $600 transaction (036f58ac-7330-42c3-8bd3-cdc5ea865284) and $165.92 transaction 
-- are marked as cleared but don't have journal entries created

-- Step 1: Get the next journal entry number
SELECT entry_number FROM journal_entries 
ORDER BY entry_number DESC LIMIT 1;

-- Step 2: Get bank account chart_account_id for the bank where these transactions are
SELECT id, account_name, chart_account_id FROM bank_accounts 
WHERE account_type = 'Checking' 
LIMIT 1;

-- Step 3: Get the Owner Draws account ID (3100)
SELECT id, account_number, account_name FROM accounts 
WHERE account_number = '3100' OR account_name ILIKE '%owner%draw%'
LIMIT 1;

-- Step 4: Create journal entry for $600 transaction (replace IDs with values from above)
-- This assumes:
-- - Bank Chart Account ID (from bank_accounts.chart_account_id)
-- - Owner Draws Account ID (from accounts.id where account_number = '3100')

INSERT INTO journal_entries (
  entry_number,
  entry_date,
  description,
  reference_type,
  reference_id,
  is_posted,
  created_by,
  company_id
)
VALUES (
  'JE-2026-00135',  -- Use next available number from Step 1
  '2025-12-22',
  'OLB XFER TO 1321 - Owner Draws',
  'bank_transaction',
  '036f58ac-7330-42c3-8bd3-cdc5ea865284',
  TRUE,
  'YOUR-USER-ID-HERE',
  'YOUR-COMPANY-ID-HERE'
)
RETURNING id;

-- Step 5: Add journal entry lines for $600 transaction
-- After Step 4, use the returned journal_entry_id in the INSERT below
INSERT INTO journal_entry_lines (
  entry_id,
  account_id,
  debit,
  credit,
  description
)
VALUES 
  -- Bank account credit (decreases bank balance)
  ('JOURNAL-ENTRY-ID-FROM-STEP4', 'BANK-CHART-ACCOUNT-ID', 0, 600.00, 'Bank transaction'),
  -- Owner Draws debit (increases owner draws withdrawal)
  ('JOURNAL-ENTRY-ID-FROM-STEP4', 'OWNER-DRAWS-ACCOUNT-ID', 600.00, 0, 'Owner Draws');

-- Step 6: Create journal entry for $165.92 CASH APP transaction
-- (Replace with its ID: cd98c5cc-6357-4edf-8c5f-ce2784201e8d)
INSERT INTO journal_entries (
  entry_number,
  entry_date,
  description,
  reference_type,
  reference_id,
  is_posted,
  created_by,
  company_id
)
VALUES (
  'JE-2026-00136',
  '2025-12-16',
  'CASH APP*DUSTINOAKLAND CA CC - Transaction',
  'bank_transaction',
  'cd98c5cc-6357-4edf-8c5f-ce2784201e8d',
  TRUE,
  'YOUR-USER-ID-HERE',
  'YOUR-COMPANY-ID-HERE'
)
RETURNING id;

-- After Step 6, use the returned ID for these lines:
INSERT INTO journal_entry_lines (
  entry_id,
  account_id,
  debit,
  credit,
  description
)
VALUES
  -- Bank account debit (increases bank balance for deposit)
  ('JOURNAL-ENTRY-ID-FROM-STEP6', 'BANK-CHART-ACCOUNT-ID', 165.92, 0, 'Bank transaction'),
  -- Category account credit (decreases category account)
  ('JOURNAL-ENTRY-ID-FROM-STEP6', 'CATEGORY-ACCOUNT-ID', 0, 165.92, 'CASH APP deposit');
