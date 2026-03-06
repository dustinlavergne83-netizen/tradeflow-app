-- ====================================
-- LINK: Set project_id on the 3 Moultrie time entries
-- ====================================

-- First, see what entries exist with this notes value
SELECT id, notes, project_id, clock_in, clock_out
FROM time_entries
WHERE notes = 'Moultrie, Lighting Repairs'
ORDER BY clock_in DESC;

-- Link them to the Moultrie project
UPDATE time_entries
SET project_id = '4b441890-e5a2-4cbb-92c9-aabce5178ed1'
WHERE notes = 'Moultrie, Lighting Repairs'
  AND project_id IS NULL;
