-- FINAL FIX: Manually clear the $4,000 from both AR and Customer Deposits
-- This creates the missing second journal entry and updates balances

-- Step 1: Get the account IDs we need
-- We'll find the AR and Customer Deposits accounts and any liability account for unearned revenue

-- Step 2: Create the missing second journal entry to clear the deposit
-- (This is what SHOULD have been created when the final payment was recorded)

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
  (SELECT COALESCE(MAX(entry_number), 0) + 1 FROM journal_entries WHERE company_id = (SELECT company_id FROM invoices WHERE invoice_number = '1004-1' LIMIT 1)),
  NOW()::date,
  'Clear deposit liability - Invoice #1004-1 fully paid',
  'invoice_payment',
  id,
  true,
  created_by,
  (SELECT company_id FROM accounts WHERE account_number = '1100' LIMIT 1)
FROM invoices
WHERE invoice_number = '1004-1'
RETURNING id INTO _entry_id;

-- Step 3: Create the journal entry lines for this new entry
-- Line 1: Debit Customer Deposits (clear the liability)
-- Line 2: Credit AR (clear the outstanding balance)

WITH new_entry AS (
  SELECT je.id, je.company_id
  FROM journal_entries je
  WHERE je.description = 'Clear deposit liability - Invoice #1004-1 fully paid'
    AND je.is_posted = true
  LIMIT 1
)
INSERT INTO journal_entry_lines (entry_id, line_number, account_id, debit, credit, description)
SELECT 
  new_entry.id,
  1,
  (SELECT id FROM accounts WHERE account_number = '2700' AND company_id = new_entry.company_id LIMIT 1),
  4000,
  0,
  'Clear deposit liability'
FROM new_entry
UNION ALL
SELECT 
  new_entry.id,
  2,
  (SELECT id FROM accounts WHERE account_number = '1100' AND company_id = new_entry.company_id LIMIT 1),
  0,
  4000,
  'Offset deposit in AR'
FROM new_entry;

-- Step 4: Update the account balances directly (force recalculation)
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
WHERE account_number IN ('1100', '2700');

-- Step 5: Verify the fix
SELECT 
  account_name,
  account_number,
  account_type,
  balance,
  CASE 
    WHEN balance = 0 THEN '✅ FIXED!'
    ELSE '❌ Still has balance'
  END as status
FROM accounts
WHERE account_number IN ('1100', '2700', '1830')
ORDER BY account_number;
