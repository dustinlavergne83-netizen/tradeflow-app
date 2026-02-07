-- ============================================
-- DIRECT FIX FOR LOWES CREDIT CARD ACCOUNT
-- ============================================
-- 
-- This fixes the sign issue where payments are ADDING to the negative
-- instead of reducing it.
--
-- The problem: Account 2110 is set to the WRONG account type
-- The solution: Set it to Liability with normal_balance='credit'

-- Step 1: Check current account state
SELECT 
  id,
  account_number,
  account_name,
  account_type,
  normal_balance,
  balance
FROM accounts
WHERE account_number = '2110'
   OR account_name ILIKE '%lowes%';

-- Step 2: FIX THE ACCOUNT (RUN THIS)
UPDATE accounts
SET 
  account_type = 'Liability',
  normal_balance = 'credit'
WHERE account_number = '2110'
   OR account_name ILIKE '%lowes%';

-- Step 3: VERIFY the fix worked
SELECT 
  id,
  account_number,
  account_name,
  account_type,
  normal_balance,
  balance
FROM accounts
WHERE account_number = '2110'
   OR account_name ILIKE '%lowes%';

-- ============================================
-- WHAT COMES NEXT (MANUAL IN UI):
-- ============================================
--
-- 1. Go to Chart of Accounts → Refresh (F5)
-- 2. Verify account 2110 now shows as "Liability" type
-- 3. Go to Bank Transactions
-- 4. Find any CLEARED Lowes payments
-- 5. For EACH cleared payment:
--    a) UNCHECK it (mark not cleared) → This deletes the wrong journal entry
--    b) RECHECK it (mark cleared) → This creates the CORRECT journal entry
-- 6. Watch the Chart of Accounts balance DECREASE (become less negative)
--    Example: -$6,723.14 → [pay $500] → -$6,223.14 ✓
--
-- If it goes MORE negative (like -$7,223.14), then the fix didn't work
-- and you need to check the account settings again.
