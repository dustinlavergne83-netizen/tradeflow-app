-- ====================================
-- FIX: Link Ty Weldon's shift_segments to Moultrie project
-- The Project Detail page queries shift_segments by project_id
-- These entries have project_task set but project_id is NULL
-- ====================================

-- STEP 1: See what shift_segments exist for Moultrie (by project_task name)
SELECT ss.id, ss.user_id, ss.project_id, ss.project_task, ss.start_at, ss.end_at,
       e.first_name, e.last_name
FROM shift_segments ss
LEFT JOIN employees e ON e.id = ss.user_id
WHERE ss.project_task ILIKE '%Moultrie%'
ORDER BY ss.start_at DESC;

-- STEP 2: Link ALL Moultrie shift_segments to the correct project_id
-- Moultrie project ID: 4b441890-e5a2-4cbb-92c9-aabce5178ed1
UPDATE shift_segments
SET project_id = '4b441890-e5a2-4cbb-92c9-aabce5178ed1'
WHERE project_task ILIKE '%Moultrie%'
  AND (project_id IS NULL OR project_id != '4b441890-e5a2-4cbb-92c9-aabce5178ed1');

-- STEP 3: Also link time_entries (old table) in case they're still used somewhere
UPDATE time_entries
SET project_id = '4b441890-e5a2-4cbb-92c9-aabce5178ed1'
WHERE (notes ILIKE '%Moultrie%' OR project_task ILIKE '%Moultrie%')
  AND (project_id IS NULL OR project_id != '4b441890-e5a2-4cbb-92c9-aabce5178ed1');

-- STEP 4: Verify the fix
SELECT ss.id, ss.user_id, ss.project_id, ss.project_task, ss.start_at, ss.end_at,
       e.first_name, e.last_name,
       p.name as project_name
FROM shift_segments ss
LEFT JOIN employees e ON e.id = ss.user_id
LEFT JOIN projects p ON p.id = ss.project_id
WHERE ss.project_id = '4b441890-e5a2-4cbb-92c9-aabce5178ed1'
ORDER BY ss.start_at DESC;
