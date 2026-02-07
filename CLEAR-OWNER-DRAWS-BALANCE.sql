-- ============================================================================
-- CLEAR OWNER DRAWS ACCOUNT BALANCE
-- ============================================================================
-- This SQL script resets the Owner Draws account balance to 0
-- Use this after cleaning up incorrect journal entries or transactions
--
-- NOTE: Make sure you have backed up your database before running this!
-- ============================================================================

-- First, let's check what the current Owner Draws balance is:
SELECT 
  id,
  account_number,
  account_name,
  account_type,
  balance
FROM accounts
WHERE account_name ILIKE '%owner%draws%'
  OR account_name ILIKE '%owner%draw%'
  OR (account_type = 'Equity' AND account_name ILIKE '%draw%')
ORDER BY account_number;

-- ============================================================================
-- OPTION 1: Clear by exact account name (modify as needed)
-- ============================================================================
UPDATE accounts
SET balance = 0
WHERE account_name = 'Owner Draws'
  AND account_type = 'Equity';

-- Verify the update:
SELECT 
  id,
  account_number,
  account_name,
  account_type,
  balance
FROM accounts
WHERE account_name = 'Owner Draws';

-- ============================================================================
-- OPTION 2: If you know the account number, use this instead:
-- ============================================================================
-- UPDATE accounts
-- SET balance = 0
-- WHERE account_number = '3010'  -- Replace with your actual owner draws account number
--   AND account_type = 'Equity';

-- ============================================================================
-- OPTION 3: Clear ALL equity accounts (use with caution!)
-- ============================================================================
-- UPDATE accounts
-- SET balance = 0
-- WHERE account_type = 'Equity'
--   AND account_name ILIKE '%draw%';

-- ============================================================================
-- If you need to see all equity accounts:
-- ============================================================================
-- SELECT 
--   id,
--   account_number,
--   account_name,
--   account_type,
--   balance
-- FROM accounts
-- WHERE account_type = 'Equity'
-- ORDER BY account_number;

-- ============================================================================
-- To recalculate balances from journal entries instead, use this approach:
-- ============================================================================
-- UPDATE accounts a
-- SET balance = (
--   SELECT COALESCE(SUM(CASE 
--     WHEN jel.account_id = a.id THEN jel.debit - jel.credit
--     ELSE 0
--   END), 0)
--   FROM journal_entry_lines jel
--   JOIN journal_entries je ON jel.entry_id = je.id
--   WHERE je.posted = true OR je.is_posted = true
-- )
-- WHERE account_type = 'Equity'
--   AND account_name ILIKE '%owner%draw%';
