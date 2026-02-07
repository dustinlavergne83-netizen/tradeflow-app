-- CRITICAL FIX: Clear Customer Deposits and AR for invoice with deposit issue
-- This fixes the lingering $4,000 in Customer Deposits and AR accounts

-- First, let's identify the problematic accounts and their current balances
SELECT 
  id, 
  account_number, 
  account_name, 
  account_type, 
  balance,
  is_system_calculated
FROM accounts
WHERE account_name IN ('Customer Deposits', 'Accounts Receivable')
  OR account_number IN ('1100', '1700')
LIMIT 10;

-- Now let's recalculate the balances for these accounts from their journal entries
-- This will force the system to sum up all posted journal entries and update the balance

BEGIN;

-- For Customer Deposits account (1700)
UPDATE accounts 
SET balance = (
  SELECT COALESCE(SUM(
    CASE 
      WHEN jel.debit > 0 THEN jel.debit
      WHEN jel.credit > 0 THEN -jel.credit
      ELSE 0
    END
  ), 0)
  FROM journal_entry_lines jel
  JOIN journal_entries je ON jel.entry_id = je.id
  WHERE jel.account_id = accounts.id 
    AND je.is_posted = true
)
WHERE account_name = 'Customer Deposits' 
  OR account_number = '1700';

-- For Accounts Receivable account (1100)
UPDATE accounts 
SET balance = (
  SELECT COALESCE(SUM(
    CASE 
      WHEN jel.debit > 0 THEN jel.debit
      WHEN jel.credit > 0 THEN -jel.credit
      ELSE 0
    END
  ), 0)
  FROM journal_entry_lines jel
  JOIN journal_entries je ON jel.entry_id = je.id
  WHERE jel.account_id = accounts.id 
    AND je.is_posted = true
)
WHERE account_name = 'Accounts Receivable' 
  OR account_number = '1100';

COMMIT;

-- Verify the results
SELECT 
  account_name,
  account_number,
  balance,
  'AFTER FIX' as status
FROM accounts
WHERE account_name IN ('Customer Deposits', 'Accounts Receivable')
  OR account_number IN ('1100', '1700');
