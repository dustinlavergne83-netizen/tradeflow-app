-- DIAGNOSTIC: Check Lowes Credit Card Account Configuration
-- This will identify and fix the sign issue with account 2110

-- Step 1: Check current account configuration
SELECT 
  id,
  account_number,
  account_name,
  account_type,
  normal_balance,
  amount
FROM accounts
WHERE account_number = '2110' OR account_name ILIKE '%Lowes%';

-- Step 2: Check for any journal entries on this account
SELECT 
  je.id,
  je.entry_number,
  je.description,
  jel.debit,
  jel.credit,
  (jel.debit - jel.credit) as impact
FROM journal_entries je
JOIN journal_entry_lines jel ON je.id = jel.entry_id
WHERE jel.account_id IN (
  SELECT id FROM accounts WHERE account_number = '2110'
)
ORDER BY je.entry_number;

-- Step 3: Fix the account configuration (RUN THIS SEPARATELY)
-- The account must be:
-- 1. Type = 'Liability' (not 'Credit Card' or anything else)
-- 2. normal_balance = 'credit' (not 'debit')

UPDATE accounts
SET 
  account_type = 'Liability',
  normal_balance = 'credit'
WHERE account_number = '2110';

-- Step 4: Verify the fix
SELECT 
  id,
  account_number,
  account_name,
  account_type,
  normal_balance,
  amount
FROM accounts
WHERE account_number = '2110';

-- EXPLANATION:
-- For a LIABILITY account (normal balance = CREDIT):
-- - Opening balance -6311.57 means you OWE $6311.57
-- - When you make a payment (withdrawal from bank):
--   * Bank account: DEBIT $500 (reduce bank)
--   * Lowes account: DEBIT $500 (reduce liability - makes negative smaller)
--   * Result: -6311.57 - (-500) = -5811.57 ✓ CORRECT
--
-- The journal entry logic will automatically handle this correctly
-- once the account is marked as Liability with normal_balance='credit'
