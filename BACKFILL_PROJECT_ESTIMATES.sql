-- ============================================================
-- BACKFILL project_id ON EXISTING PROJECT ESTIMATES
-- ============================================================
-- This fixes estimates created before project_id was saved.
-- Matches estimates to projects by name.
-- Run once in Supabase SQL Editor.
-- ============================================================

-- Preview what will be updated
SELECT 
  e.id,
  e.estimate_number,
  e.project_name,
  p.id AS project_id,
  p.name AS matched_project_name
FROM estimates e
JOIN projects p ON LOWER(TRIM(p.name)) = LOWER(TRIM(e.project_name))
WHERE e.project_id IS NULL
  AND e.project_name IS NOT NULL
  AND e.project_name != ''
  AND e.project_name != 'Quick Estimate'
ORDER BY e.created_at DESC;

-- Run the actual update (uncomment when ready)
/*
UPDATE estimates e
SET project_id = p.id
FROM projects p
WHERE LOWER(TRIM(p.name)) = LOWER(TRIM(e.project_name))
  AND e.project_id IS NULL
  AND e.project_name IS NOT NULL
  AND e.project_name != ''
  AND e.project_name != 'Quick Estimate';
*/

-- Verify after running
-- SELECT id, estimate_number, project_name, project_id FROM estimates ORDER BY created_at DESC LIMIT 20;
