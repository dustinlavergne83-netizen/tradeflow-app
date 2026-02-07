-- DIAGNOSE WHY TRANSACTIONS ARE DISAPPEARING WHEN CLEARING OWNER DRAWS

-- Step 1: Show ALL transactions in the bank account (regardless of any filter)
SELECT 
  id,
  transaction_date,
  amount,
  description,
  is_cleared,
  is_owner_draw,
  draw_status,
  created_at,
  updated_at
FROM bank_transactions
WHERE is_owner_draw = TRUE
ORDER BY transaction_date DESC;

-- Step 2: Check if there are any triggers on bank_transactions that might auto-update related rows
SELECT 
  trigger_schema,
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE event_object_table = 'bank_transactions'
ORDER BY trigger_name;

-- Step 3: Check if any RLS policies are filtering the view
SELECT 
  schemaname,
  tablename,
  polname,
  qual
FROM pg_policies
WHERE tablename = 'bank_transactions';

-- Step 4: Look for any pending transactions (not yet marked cleared/uncleared properly)
SELECT 
  id,
  transaction_date,
  amount,
  description,
  is_cleared,
  draw_status,
  is_owner_draw
FROM bank_transactions
WHERE is_cleared IS NULL
   OR draw_status IS NULL
ORDER BY transaction_date DESC
LIMIT 20;

-- Step 5: Check the bank_transactions table structure
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'bank_transactions'
ORDER BY ordinal_position;

-- Step 6: Count transactions by status
SELECT 
  'is_cleared' as status_field,
  is_cleared,
  COUNT(*) as count
FROM bank_transactions
GROUP BY is_cleared

UNION ALL

SELECT 
  'draw_status' as status_field,
  draw_status,
  COUNT(*) as count
FROM bank_transactions
GROUP BY draw_status;

-- Step 7: Find any duplicate transactions (same amount, date, description)
SELECT 
  transaction_date,
  amount,
  description,
  COUNT(*) as duplicate_count,
  STRING_AGG(id::text, ', ') as transaction_ids
FROM bank_transactions
WHERE is_owner_draw = TRUE
GROUP BY transaction_date, amount, description
HAVING COUNT(*) > 1
ORDER BY transaction_date DESC;

-- Step 8: Check if any rows are being soft-deleted or hidden by a status field
SELECT 
  *
FROM bank_transactions
WHERE is_owner_draw = TRUE
  AND (is_cleared IS NULL OR draw_status IS NULL)
LIMIT 10;
