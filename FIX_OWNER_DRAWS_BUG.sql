-- FIX: Restore and properly mark owner draw transactions
-- The issue is that owner draws aren't flagged as is_owner_draw = TRUE

-- Step 1: Identify transactions that SHOULD be owner draws but aren't marked
-- (based on payee or description containing owner/draw names)
-- First, let's see what transactions exist
SELECT 
  id,
  transaction_date,
  amount,
  description,
  payee,
  is_cleared,
  is_owner_draw,
  draw_status,
  CASE 
    WHEN description ILIKE '%owner%' OR description ILIKE '%draw%' THEN 'YES - description'
    WHEN payee ILIKE '%dustin%' OR payee ILIKE '%lavergne%' THEN 'YES - payee'
    ELSE 'NO'
  END as should_be_owner_draw
FROM bank_transactions
WHERE (
  description ILIKE '%owner%' 
  OR description ILIKE '%draw%'
  OR payee ILIKE '%dustin%'
  OR payee ILIKE '%lavergne%'
)
ORDER BY transaction_date DESC
LIMIT 100;

-- Step 2: Mark all transactions that look like owner draws
UPDATE bank_transactions
SET is_owner_draw = TRUE,
    draw_status = COALESCE(draw_status, 'pending')
WHERE (
  description ILIKE '%owner%' 
  OR description ILIKE '%draw%'
  OR payee ILIKE '%dustin%'
  OR payee ILIKE '%lavergne%'
)
AND is_owner_draw = FALSE;

-- Step 3: Verify they're now showing up
SELECT 
  COUNT(*) as owner_draw_count,
  SUM(ABS(amount)) as total_owner_draws
FROM bank_transactions
WHERE is_owner_draw = TRUE;

-- Step 4: Show the fixed owner draws
SELECT 
  id,
  transaction_date,
  amount,
  description,
  payee,
  is_cleared,
  is_owner_draw,
  draw_status
FROM bank_transactions
WHERE is_owner_draw = TRUE
ORDER BY transaction_date DESC;
