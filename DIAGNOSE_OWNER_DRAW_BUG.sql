-- DIAGNOSE OWNER DRAW CLEARING BUG
-- This script helps identify why clearing an owner draw removes other cleared transactions

-- Step 1: Show all owner draws marked as cleared
SELECT 
  'Owner Draws' as type,
  bt.id,
  bt.transaction_date,
  bt.amount,
  bt.description,
  bt.is_owner_draw,
  bt.is_cleared,
  bt.draw_status,
  ba.account_name,
  ba.account_type
FROM bank_transactions bt
JOIN bank_accounts ba ON bt.bank_account_id = ba.id
WHERE bt.is_owner_draw = TRUE
  AND bt.is_cleared = TRUE
ORDER BY bt.transaction_date DESC
LIMIT 20;

-- Step 2: Show transactions with is_cleared = FALSE but is_owner_draw = TRUE
SELECT 
  'Uncleared Owner Draws' as type,
  COUNT(*) as count,
  SUM(CASE WHEN bt.is_cleared = FALSE THEN 1 ELSE 0 END) as uncleared
FROM bank_transactions bt
WHERE bt.is_owner_draw = TRUE;

-- Step 3: Check if any draws were recently settled
SELECT 
  'Recent Settlements' as type,
  ods.id,
  ods.settlement_date,
  ods.total_draws,
  ods.period_start,
  ods.period_end,
  COUNT(bt.id) as draws_affected
FROM owner_draw_settlements ods
LEFT JOIN bank_transactions bt 
  ON bt.is_owner_draw = TRUE 
  AND bt.draw_status = 'settled'
  AND bt.transaction_date >= ods.period_start
  AND bt.transaction_date <= ods.period_end
ORDER BY ods.settlement_date DESC
LIMIT 10;

-- Step 4: Check for any UPDATE history or triggers that might affect is_cleared
-- Show the structure of bank_transactions
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'bank_transactions'
ORDER BY ordinal_position;

-- Step 5: Check what transactions match the settlement criteria
SELECT 
  bt.id,
  bt.transaction_date,
  bt.amount,
  bt.is_cleared,
  bt.is_owner_draw,
  bt.draw_status,
  ba.account_name
FROM bank_transactions bt
JOIN bank_accounts ba ON bt.bank_account_id = ba.id
WHERE bt.is_owner_draw = TRUE
  AND bt.is_cleared = TRUE
  AND bt.draw_status IN ('approved', 'pending', 'reviewed')
  AND bt.transaction_date >= CURRENT_DATE - INTERVAL '90 days'
  AND bt.transaction_date <= CURRENT_DATE
ORDER BY bt.transaction_date DESC;
