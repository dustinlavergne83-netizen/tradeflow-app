-- RESTORE ALL BANK TRANSACTIONS TO CLEARED AND RECONCILED
-- This restores all transactions to cleared/reconciled state after the accidental reset

UPDATE bank_transactions
SET 
  is_cleared = TRUE,
  is_reconciled = TRUE
WHERE is_cleared = FALSE 
   OR is_reconciled = FALSE;

-- Verify the restore
SELECT 
  COUNT(*) as total_transactions,
  SUM(CASE WHEN is_cleared = TRUE THEN 1 ELSE 0 END) as now_cleared,
  SUM(CASE WHEN is_reconciled = TRUE THEN 1 ELSE 0 END) as now_reconciled,
  SUM(CASE WHEN is_owner_draw = TRUE THEN 1 ELSE 0 END) as owner_draws_in_total
FROM bank_transactions;

-- Show any uncleared transactions that may remain
SELECT 
  id,
  amount,
  is_cleared,
  is_reconciled,
  is_owner_draw
FROM bank_transactions
WHERE is_cleared = FALSE OR is_reconciled = FALSE
LIMIT 20;
