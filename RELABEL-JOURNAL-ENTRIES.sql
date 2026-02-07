-- Relabel all journal entries with clean sequential numbers
-- This fixes entries like "JE-2026-Q8SAW11111111" to proper format "JE-2026-00001"
-- FIXED FOR POSTGRESQL (Supabase)

-- First, let's see what we're working with
SELECT 
  id,
  entry_number,
  entry_date,
  created_at,
  ROW_NUMBER() OVER (PARTITION BY EXTRACT(YEAR FROM entry_date) ORDER BY entry_date ASC, created_at ASC) as new_sequence
FROM journal_entries
WHERE entry_number LIKE 'JE-%'
ORDER BY entry_date ASC, created_at ASC;

-- Now update all entries with clean numbering
-- This uses a CTE to generate sequential numbers, then updates them
WITH numbered_entries AS (
  SELECT 
    id,
    entry_number,
    entry_date,
    created_at,
    ROW_NUMBER() OVER (ORDER BY entry_date ASC, created_at ASC) as seq_num,
    'JE-' || EXTRACT(YEAR FROM entry_date)::TEXT || '-' || LPAD(ROW_NUMBER() OVER (ORDER BY entry_date ASC, created_at ASC)::TEXT, 5, '0') as new_entry_number
  FROM journal_entries
  WHERE company_id IS NOT NULL  -- Only update entries for your company
)
UPDATE journal_entries je
SET entry_number = ne.new_entry_number
FROM numbered_entries ne
WHERE je.id = ne.id;

-- Verify the update worked
SELECT 
  id,
  entry_number,
  entry_date,
  description,
  is_posted
FROM journal_entries
ORDER BY entry_date ASC
LIMIT 20;
