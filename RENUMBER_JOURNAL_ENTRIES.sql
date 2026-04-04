-- ============================================================
-- RENUMBER ALL JOURNAL ENTRIES SEQUENTIALLY
-- Renumbers entries to JE-YYYY-00001, JE-YYYY-00002, etc.
-- ordered by entry_date (oldest first)
-- ============================================================

-- PREVIEW FIRST: Run this SELECT to see what will change before applying
SELECT
  id,
  entry_number AS old_entry_number,
  entry_date,
  CONCAT(
    'JE-',
    EXTRACT(YEAR FROM entry_date::date)::text,
    '-',
    LPAD(ROW_NUMBER() OVER (
      PARTITION BY EXTRACT(YEAR FROM entry_date::date)
      ORDER BY entry_date ASC, created_at ASC
    )::text, 5, '0')
  ) AS new_entry_number,
  description
FROM journal_entries
ORDER BY entry_date ASC, created_at ASC;


-- ============================================================
-- APPLY THE RENUMBERING
-- Temporarily drop the unique constraint, renumber, then restore
-- (Supabase/Postgres: run each block separately if needed)
-- ============================================================

-- STEP 1: Drop the unique constraint temporarily
ALTER TABLE journal_entries
  DROP CONSTRAINT IF EXISTS journal_entries_company_id_entry_number_key;

-- STEP 2: Renumber all entries per year, ordered by date
WITH numbered AS (
  SELECT
    id,
    CONCAT(
      'JE-',
      EXTRACT(YEAR FROM entry_date::date)::text,
      '-',
      LPAD(ROW_NUMBER() OVER (
        PARTITION BY EXTRACT(YEAR FROM entry_date::date)
        ORDER BY entry_date ASC, created_at ASC
      )::text, 5, '0')
    ) AS new_entry_number
  FROM journal_entries
)
UPDATE journal_entries je
SET entry_number = n.new_entry_number
FROM numbered n
WHERE je.id = n.id;

-- STEP 3: Restore the unique constraint
ALTER TABLE journal_entries
  ADD CONSTRAINT journal_entries_company_id_entry_number_key
  UNIQUE (company_id, entry_number);

-- STEP 4: Verify the result
SELECT
  entry_number,
  entry_date,
  description,
  is_posted
FROM journal_entries
ORDER BY entry_date ASC, entry_number ASC;
