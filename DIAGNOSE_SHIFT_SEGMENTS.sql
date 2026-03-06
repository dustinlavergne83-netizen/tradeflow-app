-- ====================================
-- DIAGNOSE: What's in shift_segments?
-- Run each step ONE AT A TIME
-- ====================================

-- Step 1: What is the EXACT project name?
SELECT id, name FROM projects 
WHERE id = '4b441890-e5a2-4cbb-92c9-aabce5178ed1';

-- Step 2: ALL unique project_task values in shift_segments
SELECT DISTINCT project_task, COUNT(*) as cnt
FROM shift_segments
GROUP BY project_task
ORDER BY cnt DESC;

-- Step 3: Any Moultrie-related segments?
SELECT id, shift_id, project_task, start_at, end_at,
  ROUND(EXTRACT(EPOCH FROM (end_at - start_at)) / 3600, 2) as hours
FROM shift_segments
WHERE project_task ILIKE '%moultrie%'
ORDER BY start_at DESC;

-- Step 4: What columns does shifts table have?
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'shifts'
ORDER BY ordinal_position;

-- Step 5: Recent shifts (using user_id, not employee_id)
SELECT id, user_id, clock_in, clock_out
FROM shifts
ORDER BY clock_in DESC
LIMIT 10;

-- Step 6: time_entries - what columns exist?
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'time_entries'
ORDER BY ordinal_position;

-- Step 7: Any Moultrie in time_entries? (only select existing columns)
SELECT id, project_id, notes, clock_in, clock_out
FROM time_entries
WHERE notes ILIKE '%moultrie%'
   OR project_id = '4b441890-e5a2-4cbb-92c9-aabce5178ed1'
ORDER BY clock_in DESC;
