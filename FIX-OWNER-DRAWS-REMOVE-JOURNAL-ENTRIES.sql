-- ============================================================================
-- FIX: Remove all journal entries for Owner Draws account
-- ============================================================================
-- This script removes all journal entry LINES for Owner Draws account,
-- which will reset its balance to $0 in the Chart of Accounts
--
-- NOTE: Make sure you have backed up your database before running this!
-- ============================================================================

-- Step 1: Find the Owner Draws account ID
SELECT 
  id,
  account_number,
  account_name,
  account_type,
  balance
FROM accounts
WHERE (account_name ILIKE '%owner%draw%' OR account_name = 'Owner Draws')
  AND account_type = 'Equity'
LIMIT 1;

-- ============================================================================
-- Step 2: View all journal entry lines for Owner Draws
-- ============================================================================
-- This shows what transactions are creating the balance
SELECT 
  jel.id as line_id,
  je.id as entry_id,
  je.entry_number,
  je.entry_date,
  je.description,
  jel.debit,
  jel.credit,
  a.account_name,
  (jel.debit - jel.credit) as net_amount
FROM journal_entry_lines jel
JOIN journal_entries je ON jel.entry_id = je.id
JOIN accounts a ON jel.account_id = a.id
WHERE a.account_name = 'Owner Draws'
  OR (a.account_type = 'Equity' AND a.account_name ILIKE '%owner%draw%')
ORDER BY je.entry_date DESC;

-- ============================================================================
-- Step 3: Delete all journal entry lines for Owner Draws account
-- ============================================================================
DELETE FROM journal_entry_lines
WHERE account_id IN (
  SELECT id FROM accounts
  WHERE (account_name = 'Owner Draws' OR account_name ILIKE '%owner%draw%')
    AND account_type = 'Equity'
);

-- Verify deletion:
SELECT COUNT(*) as remaining_lines
FROM journal_entry_lines
WHERE account_id IN (
  SELECT id FROM accounts
  WHERE (account_name = 'Owner Draws' OR account_name ILIKE '%owner%draw%')
    AND account_type = 'Equity'
);

-- ============================================================================
-- Step 4: Delete orphaned journal entries (entries with no lines)
-- ============================================================================
DELETE FROM journal_entries
WHERE id NOT IN (
  SELECT DISTINCT entry_id FROM journal_entry_lines
)
AND (
  SELECT COUNT(*) FROM journal_entry_lines jel 
  WHERE jel.entry_id = journal_entries.id
) = 0;

-- ============================================================================
-- Step 5: Update account balances to recalculate from remaining entries
-- ============================================================================
UPDATE accounts a
SET balance = (
  SELECT COALESCE(SUM(jel.debit - jel.credit), 0)
  FROM journal_entry_lines jel
  JOIN journal_entries je ON jel.entry_id = je.id
  WHERE jel.account_id = a.id
    AND (je.posted = true OR je.is_posted = true)
)
WHERE account_type = 'Equity'
  AND (account_name = 'Owner Draws' OR account_name ILIKE '%owner%draw%');

-- Step 6: Verify the Owner Draws account is now at $0
SELECT 
  id,
  account_number,
  account_name,
  account_type,
  balance
FROM accounts
WHERE (account_name = 'Owner Draws' OR account_name ILIKE '%owner%draw%')
  AND account_type = 'Equity';

-- ============================================================================
-- ALTERNATIVE: If you need to delete by account ID (if you know it)
-- ============================================================================
-- DELETE FROM journal_entry_lines
-- WHERE account_id = 'YOUR_ACCOUNT_ID_HERE';

-- ============================================================================
-- CLEANUP: Show summary of changes
-- ============================================================================
SELECT 
  COUNT(*) as total_accounts,
  SUM(CASE WHEN balance = 0 THEN 1 ELSE 0 END) as zero_balance_accounts,
  SUM(CASE WHEN balance != 0 THEN 1 ELSE 0 END) as non_zero_accounts
FROM accounts
WHERE account_type = 'Equity';
