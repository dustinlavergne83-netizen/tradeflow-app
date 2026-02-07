-- ==========================================
-- CLEAN UP ORPHANED JOURNAL ENTRIES FOR LOWES TRANSACTION
-- ==========================================
-- Run this script to remove any duplicate/orphaned journal entries for the $250 Lowe's transaction

-- STEP 1: Find the transaction ID (look for $250 Lowe's withdrawal)
SELECT id, description, amount, transaction_date FROM bank_transactions 
WHERE amount = -250 AND description ILIKE '%lowes%'
ORDER BY transaction_date DESC LIMIT 5;

-- STEP 2: Once you have the transaction ID, use it below to delete orphaned entries
-- Replace 'YOUR_TRANSACTION_ID' with the actual transaction ID from STEP 1

-- First, delete all journal entry lines for this transaction
DELETE FROM journal_entry_lines 
WHERE entry_id IN (
  SELECT id FROM journal_entries 
  WHERE reference_type = 'bank_transaction' 
  AND reference_id = 'YOUR_TRANSACTION_ID'
);

-- Then delete the journal entries themselves
DELETE FROM journal_entries 
WHERE reference_type = 'bank_transaction' 
AND reference_id = 'YOUR_TRANSACTION_ID';

-- Verify they're deleted
SELECT COUNT(*) as remaining_entries FROM journal_entries 
WHERE reference_type = 'bank_transaction' 
AND reference_id = 'YOUR_TRANSACTION_ID';

-- ==========================================
-- NUCLEAR OPTION: If you want to delete ALL duplicate journal entries 
-- (entries with the same entry_number that exist multiple times)
-- ==========================================

-- Find duplicate entries
SELECT entry_number, COUNT(*) as count FROM journal_entries 
GROUP BY entry_number 
HAVING COUNT(*) > 1 
ORDER BY count DESC;

-- Delete the duplicate lines first
DELETE FROM journal_entry_lines 
WHERE entry_id IN (
  SELECT je.id FROM journal_entries je
  WHERE je.entry_number IN (
    SELECT entry_number FROM journal_entries 
    GROUP BY entry_number 
    HAVING COUNT(*) > 1
  )
  AND je.reference_type = 'bank_transaction'
);

-- Then delete duplicate entries
DELETE FROM journal_entries 
WHERE entry_number IN (
  SELECT entry_number FROM journal_entries 
  GROUP BY entry_number 
  HAVING COUNT(*) > 1
)
AND reference_type = 'bank_transaction';
