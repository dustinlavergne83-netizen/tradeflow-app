-- ====================================
-- FIX MOULTRIE: Diagnose + Link entries - ALL IN ONE
-- ====================================

-- Step 1: Add the missing updated_at column
ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Step 2: Find ALL Moultrie entries - check BOTH notes AND project_task fields
SELECT id, notes, project_task, project_id, clock_in, clock_out,
  ROUND(EXTRACT(EPOCH FROM (clock_out - clock_in)) / 3600, 2) as hours
FROM time_entries
WHERE notes ILIKE '%moultrie%' 
   OR project_task ILIKE '%moultrie%'
ORDER BY clock_in DESC;

-- Step 3: See ALL unlinked entries (project_id IS NULL)
SELECT id, notes, project_task, project_id, clock_in, clock_out
FROM time_entries
WHERE project_id IS NULL
ORDER BY clock_in DESC
LIMIT 20;

-- Step 4: Link by notes field
UPDATE time_entries
SET project_id = '4b441890-e5a2-4cbb-92c9-aabce5178ed1',
    updated_at = NOW()
WHERE notes ILIKE '%moultrie%'
  AND project_id IS NULL;

-- Step 5: Link by project_task field  
UPDATE time_entries
SET project_id = '4b441890-e5a2-4cbb-92c9-aabce5178ed1',
    updated_at = NOW()
WHERE project_task ILIKE '%moultrie%'
  AND project_id IS NULL;

-- Step 6: Verify
SELECT id, notes, project_task, project_id, clock_in, clock_out,
  ROUND(EXTRACT(EPOCH FROM (clock_out - clock_in)) / 3600, 2) as hours
FROM time_entries
WHERE project_id = '4b441890-e5a2-4cbb-92c9-aabce5178ed1'
ORDER BY clock_in DESC;
