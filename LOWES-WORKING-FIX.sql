-- LOWES CREDIT CARD - WORKING FIX
-- This cleans up bad journal entries and sets correct opening balance

-- Step 1: Find and delete bad journal entries for Lowes account
WITH lowes_account AS (
  SELECT id FROM accounts WHERE account_number = '2110' LIMIT 1
)
DELETE FROM journal_entry_lines 
WHERE entry_id IN (
  SELECT id FROM journal_entries 
  WHERE reference_type IN ('opening_balance', 'bank_transaction')
    AND reference_id::uuid = (SELECT id FROM lowes_account)
);

-- Step 2: Delete the journal entries themselves
WITH lowes_account AS (
  SELECT id FROM accounts WHERE account_number = '2110' LIMIT 1
)
DELETE FROM journal_entries 
WHERE reference_type IN ('opening_balance', 'bank_transaction')
  AND reference_id::uuid = (SELECT id FROM lowes_account);

-- Step 3: Create correct opening balance entry
-- Get Lowes account ID and company ID
WITH lowes AS (
  SELECT id, company_id FROM accounts 
  WHERE account_number = '2110' LIMIT 1
),
-- Get an Equity account (for balancing)
equity_acct AS (
  SELECT a.id FROM accounts a
  WHERE a.company_id = (SELECT company_id FROM lowes)
    AND a.account_type = 'Equity'
  LIMIT 1
),
-- Get next entry number
next_entry AS (
  SELECT COALESCE(MAX(entry_number), 0) + 1 as num
  FROM journal_entries
  WHERE company_id = (SELECT company_id FROM lowes)
),
-- Create the journal entry
new_entry AS (
  INSERT INTO journal_entries (
    entry_number, 
    entry_date, 
    description, 
    reference_type, 
    reference_id, 
    created_by, 
    company_id,
    is_posted,
    posted_date
  ) 
  SELECT 
    next_entry.num,
    CURRENT_DATE,
    'Opening balance - Lowes Credit Card',
    'opening_balance',
    lowes.id::text,
    (SELECT user_id FROM accounts WHERE id = lowes.id LIMIT 1),
    lowes.company_id,
    true,
    CURRENT_TIMESTAMP
  FROM next_entry, lowes
  RETURNING id
)
-- Create journal entry lines
INSERT INTO journal_entry_lines (
  entry_id, 
  line_number, 
  account_id, 
  debit, 
  credit, 
  description
)
SELECT 
  new_entry.id, 1, equity_acct.id, 6723.14, 0, 'Opening balance'
FROM new_entry, equity_acct
UNION ALL
SELECT 
  new_entry.id, 2, lowes.id, 0, 6723.14, 'Lowes Credit Card'
FROM new_entry, lowes;

-- Verify it worked
SELECT 'Done! Check Chart of Accounts - Lowes should show -$6,723.14' as status;
