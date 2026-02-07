-- Renumber all journal entries in sequential order: JE-YYYY-00001, JE-YYYY-00002, etc.
-- This script handles the unique constraint by using temporary placeholders

-- Step 1: Update all entries to temporary unique values using their IDs
UPDATE journal_entries
SET entry_number = 'TEMP-' || id
WHERE entry_number IS NOT NULL OR entry_number = '';

-- Step 2: Now update to the final sequential format
WITH numbered_entries AS (
  SELECT 
    id,
    entry_number,
    entry_date,
    EXTRACT(YEAR FROM entry_date)::INT as entry_year,
    ROW_NUMBER() OVER (
      PARTITION BY EXTRACT(YEAR FROM entry_date)
      ORDER BY entry_date ASC, created_at ASC
    ) as seq_num
  FROM journal_entries
)
UPDATE journal_entries je
SET entry_number = 'JE-' || ne.entry_year || '-' || LPAD(ne.seq_num::TEXT, 5, '0')
FROM numbered_entries ne
WHERE je.id = ne.id;

-- Verify the changes
SELECT 
  entry_number,
  entry_date,
  description,
  created_at
FROM journal_entries
ORDER BY entry_date DESC, created_at DESC
LIMIT 20;
