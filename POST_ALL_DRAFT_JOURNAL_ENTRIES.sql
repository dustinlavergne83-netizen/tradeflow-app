-- ============================================================
-- POST ALL DRAFT JOURNAL ENTRIES
-- Marks any unposted (draft) journal entries as posted
-- Safe to run — only updates entries where is_posted = false
-- ============================================================

-- PREVIEW: See how many draft entries exist before fixing
SELECT
  COUNT(*) AS draft_count,
  MIN(entry_date) AS oldest_draft,
  MAX(entry_date) AS newest_draft
FROM journal_entries
WHERE is_posted = false OR is_posted IS NULL;

-- DETAILS: See which entries are drafts
SELECT
  entry_number,
  entry_date,
  description,
  reference_type,
  is_posted
FROM journal_entries
WHERE is_posted = false OR is_posted IS NULL
ORDER BY entry_date ASC;


-- ============================================================
-- APPLY THE FIX: Mark all drafts as posted
-- ============================================================
UPDATE journal_entries
SET
  is_posted  = true,
  posted_at  = COALESCE(posted_at, NOW()),
  posted_by  = COALESCE(posted_by, created_by)
WHERE is_posted = false
   OR is_posted IS NULL;


-- VERIFY: Should return 0 drafts after the fix
SELECT COUNT(*) AS remaining_drafts
FROM journal_entries
WHERE is_posted = false OR is_posted IS NULL;
