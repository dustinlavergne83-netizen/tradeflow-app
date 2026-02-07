-- ============================================
-- FINAL FIX: LOWES CREDIT CARD BALANCE
-- ============================================
-- The account is CORRECTLY configured as Liability + credit
-- But the BALANCE is WRONG (positive instead of negative)

-- Current state (WRONG):
-- balance: 5960.00 (POSITIVE)
-- Should be: -6311.57 (NEGATIVE - what you owe to Lowes)

-- FIX: Set the balance to the CORRECT NEGATIVE VALUE
UPDATE accounts
SET balance = -6311.57
WHERE account_number = '2110'
  AND account_name ILIKE '%lowes%';

-- VERIFY the fix
SELECT 
  account_number,
  account_name,
  account_type,
  normal_balance,
  balance
FROM accounts
WHERE account_number = '2110';

-- THEN: Delete all wrong journal entries for this account
-- and re-clear your transactions so they post correctly
