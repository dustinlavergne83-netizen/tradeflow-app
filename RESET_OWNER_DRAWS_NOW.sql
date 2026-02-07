-- RESET OWNER DRAWS - Remove from journal entries and unclear from bank
-- This script removes all owner draw transactions from the system and resets them to start fresh

-- Step 1: Get all owner draw related journal entries and delete their lines
DELETE FROM journal_entry_lines 
WHERE entry_id IN (
  SELECT je.id 
  FROM journal_entries je
  WHERE je.reference_type = 'OWNER_DRAW_SETTLEMENT'
  OR je.description ILIKE '%owner draw%'
);

-- Step 2: Delete the journal entries themselves
DELETE FROM journal_entries 
WHERE reference_type = 'OWNER_DRAW_SETTLEMENT'
OR description ILIKE '%owner draw%';

-- Step 3: Reset bank transactions marked as owner draws
UPDATE bank_transactions
SET 
  is_cleared = FALSE,
  is_reconciled = FALSE,
  reconciliation_id = NULL,
  matched_journal_entry_id = NULL,
  draw_status = 'pending'
WHERE is_owner_draw = TRUE OR draw_status IS NOT NULL;

-- Step 4: Clear owner draw settlements record
DELETE FROM owner_draw_settlements;

-- Step 5: Verify the reset (SELECT to confirm)
SELECT 
  COUNT(*) as total_owner_draws_reset,
  SUM(CASE WHEN is_cleared = FALSE THEN 1 ELSE 0 END) as uncleared,
  SUM(CASE WHEN is_reconciled = FALSE THEN 1 ELSE 0 END) as unreconciled
FROM bank_transactions
WHERE is_owner_draw = TRUE;

-- Summary
-- All owner draw bank transactions have been:
-- - Marked as UNCLEARED (is_cleared = FALSE)
-- - Marked as UNRECONCILED (is_reconciled = FALSE)  
-- - Status reset to PENDING
-- - Journal entries removed
-- - Matched journal entry references cleared
-- - You can now start fresh with owner draws
