-- Delete all journal entries related to Invoice #1004
-- This finds entries by BOTH reference_id AND description search

-- Step 1: Find all entries that mention Invoice #1004 in the description
SELECT je.id, je.entry_number, je.description, je.reference_type, je.reference_id
FROM journal_entries je
WHERE je.description LIKE '%Invoice #1004%' 
   OR je.description LIKE '%1004%';

-- Step 2: Delete the journal entry lines for these entries
DELETE FROM journal_entry_lines
WHERE entry_id IN (
  SELECT je.id FROM journal_entries je
  WHERE je.description LIKE '%Invoice #1004%' 
     OR je.description LIKE '%1004%'
);

-- Step 3: Delete the journal entries themselves
DELETE FROM journal_entries
WHERE description LIKE '%Invoice #1004%' 
   OR description LIKE '%1004%';

-- Confirmation
SELECT 'Invoice #1004 entries deleted successfully' as message;
