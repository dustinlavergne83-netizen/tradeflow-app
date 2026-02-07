-- MANUAL FIX: Delete Invoice #1004 and ALL its journal entries
-- Run this in Supabase SQL Editor to clean up

-- First, let's see what journal entries exist for 1004
SELECT 'BEFORE DELETION' as status, je.id, je.entry_number, je.description, je.reference_type, je.reference_id
FROM journal_entries je
WHERE je.description LIKE '%1004%';

-- Delete journal entry lines
DELETE FROM journal_entry_lines
WHERE entry_id IN (
  SELECT id FROM journal_entries 
  WHERE description LIKE '%1004%'
);

-- Delete journal entries  
DELETE FROM journal_entries
WHERE description LIKE '%1004%';

-- Verify deletion
SELECT 'AFTER DELETION' as status, COUNT(*) as remaining_entries
FROM journal_entries 
WHERE description LIKE '%1004%';

SELECT 'Complete - All invoice 1004 entries removed from ledger' as message;
