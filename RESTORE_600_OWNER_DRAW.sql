-- Restore the $600 owner draw to the Owner Draws ledger
-- Transaction ID: 036f58ac-7330-42c3-8bd3-cdc5ea865284 (12/22/2025)

-- Step 1: Get your user ID and bank chart account ID
SELECT 
  auth.uid() as user_id,
  ba.id as bank_account_id,
  ba.chart_account_id as bank_chart_account_id
FROM bank_accounts ba
WHERE ba.account_type = 'Checking'
LIMIT 1;

-- Step 2: Get Owner Draws account ID (3100)
SELECT id FROM accounts 
WHERE account_number = '3100' 
OR account_name ILIKE '%owner%draw%'
LIMIT 1;

-- Step 3: Create the journal entry for the $600 transaction
-- Copy your user_id, company_id, bank_chart_account_id, and owner_draws_account_id from above
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
  'JE-2026-00135',
  '2025-12-22',
  'OLB XFER TO 1321 - Owner Draws',
  'bank_transaction',
  '036f58ac-7330-42c3-8bd3-cdc5ea865284',
  TRUE,
  'YOUR-USER-ID-HERE',
  'YOUR-COMPANY-ID-HERE'
)
RETURNING id as new_entry_id;

-- Step 4: After Step 3, copy the returned entry ID and replace 'RETURNED-ENTRY-ID' below:
INSERT INTO journal_entry_lines (
  entry_id,
  account_id,
  debit,
  credit,
  description
)
VALUES 
  ('RETURNED-ENTRY-ID', 'YOUR-BANK-CHART-ACCOUNT-ID', 0.00, 600.00, 'Bank transaction'),
  ('RETURNED-ENTRY-ID', 'YOUR-OWNER-DRAWS-ACCOUNT-ID', 600.00, 0.00, 'Owner Draws');

-- Step 5: Verify the entry was created in Owner Draws account
SELECT 
  je.entry_number,
  je.entry_date,
  jel.debit,
  jel.credit,
  a.account_name
FROM journal_entry_lines jel
JOIN journal_entries je ON jel.entry_id = je.id
JOIN accounts a ON jel.account_id = a.id
WHERE je.reference_id = '036f58ac-7330-42c3-8bd3-cdc5ea865284'
ORDER BY a.account_number;
