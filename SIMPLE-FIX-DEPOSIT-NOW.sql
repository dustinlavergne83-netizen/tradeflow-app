-- SIMPLE FIX: Direct approach - create missing journal entry and update balances
-- This just does what SHOULD have been done when the final payment was recorded

-- Step 1: Create the missing journal entry
WITH invoice_data AS (
  SELECT id, invoice_number, created_by, company_id
  FROM invoices
  WHERE invoice_number = '1004-1'
  LIMIT 1
),
entry_seq AS (
  SELECT COALESCE(MAX(entry_number), 0) + 1 as next_number
  FROM journal_entries
  WHERE company_id = (SELECT company_id FROM invoice_data LIMIT 1)
)
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
SELECT 
  entry_seq.next_number,
  NOW()::date,
  'Clear deposit liability - Invoice #1004-1 fully paid',
  'invoice_payment',
  invoice_data.id,
  true,
  invoice_data.created_by,
  invoice_data.company_id
FROM invoice_data, entry_seq;

-- Step 2: Get the entry ID we just created and add journal entry lines
WITH latest_entry AS (
  SELECT id, company_id
  FROM journal_entries
  WHERE description = 'Clear deposit liability - Invoice #1004-1 fully paid'
  ORDER BY created_at DESC
  LIMIT 1
),
ar_account AS (
  SELECT id
  FROM accounts
  WHERE account_number = '1100'
  AND company_id = (SELECT company_id FROM latest_entry LIMIT 1)
  LIMIT 1
),
deposit_account AS (
  SELECT id
  FROM accounts
  WHERE account_number = '2700'
  AND company_id = (SELECT company_id FROM latest_entry LIMIT 1)
  LIMIT 1
)
INSERT INTO journal_entry_lines (entry_id, line_number, account_id, debit, credit, description)
SELECT 
  latest_entry.id,
  1,
  deposit_account.id,
  4000,
  0,
  'Clear deposit liability'
FROM latest_entry, deposit_account
UNION ALL
SELECT 
  latest_entry.id,
  2,
  ar_account.id,
  0,
  4000,
  'Offset deposit in AR'
FROM latest_entry, ar_account;

-- Step 3: Force recalculate the account balances
UPDATE accounts
SET balance = (
  SELECT COALESCE(SUM(
    CASE 
      WHEN account_type IN ('Asset', 'Expense', 'Drawing') THEN COALESCE(jel.debit, 0) - COALESCE(jel.credit, 0)
      WHEN account_type IN ('Liability', 'Equity', 'Revenue') THEN COALESCE(jel.credit, 0) - COALESCE(jel.debit, 0)
      ELSE 0
    END
  ), 0)
  FROM journal_entry_lines jel
  JOIN journal_entries je ON jel.entry_id = je.id
  WHERE jel.account_id = accounts.id
    AND je.is_posted = true
)
WHERE account_number IN ('1100', '2700', '1830')
AND is_active = true;

-- Step 4: Show the results
SELECT 
  account_name,
  account_number,
  account_type,
  balance,
  CASE 
    WHEN balance = 0 THEN '✅ FIXED!'
    ELSE '❌ Still shows balance: ' || balance
  END as status
FROM accounts
WHERE account_number IN ('1100', '2700', '1830')
ORDER BY account_number;
