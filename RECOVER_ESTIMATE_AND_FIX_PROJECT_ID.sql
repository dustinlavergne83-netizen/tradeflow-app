-- ====================================================================
-- STEP 1: Add project_id column to estimates table
-- ====================================================================
ALTER TABLE estimates ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES projects(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_estimates_project_id ON estimates(project_id);


-- ====================================================================
-- STEP 2: See all your estimates to find the lost one
-- (Run this first to identify which estimate to recover)
-- ====================================================================
SELECT 
  e.id,
  e.estimate_number,
  e.project_name,
  e.project_id,
  e.created_at,
  e.updated_at,
  COUNT(ei.id) as item_count
FROM estimates e
LEFT JOIN estimate_items ei ON ei.estimate_id = e.id
GROUP BY e.id, e.estimate_number, e.project_name, e.project_id, e.created_at, e.updated_at
ORDER BY e.created_at DESC;


-- ====================================================================
-- STEP 3: See your projects to find the right project_id
-- ====================================================================
SELECT id, name, created_at FROM projects ORDER BY created_at DESC;


-- ====================================================================
-- STEP 4: Link your estimate to the project (REPLACE the UUIDs below)
-- Copy the estimate id from Step 2, and the project id from Step 3
-- ====================================================================
-- UPDATE estimates
-- SET project_id = 'YOUR-PROJECT-UUID-HERE'
-- WHERE id = 'YOUR-ESTIMATE-UUID-HERE';


-- ====================================================================
-- STEP 5: Best-effort auto-backfill for estimates whose project_name
-- still matches a project name (in case of renames, won't match)
-- ====================================================================
UPDATE estimates e
SET project_id = p.id
FROM projects p
WHERE LOWER(e.project_name) = LOWER(p.name)
  AND e.project_id IS NULL;


-- ====================================================================
-- STEP 6: Verify - shows which estimates still need manual linking
-- ====================================================================
SELECT id, estimate_number, project_name, project_id
FROM estimates
WHERE project_id IS NULL
ORDER BY created_at DESC;
