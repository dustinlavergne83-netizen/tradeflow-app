-- ====================================
-- DIAGNOSE: Find duplicate time entries for a project
-- ====================================
-- Run this in Supabase SQL Editor to see what's going on

-- Step 1: See ALL time entries for the Moultrie project
SELECT 
  te.id,
  e.first_name || ' ' || e.last_name as employee,
  te.notes,
  te.clock_in,
  te.clock_out,
  te.project_id,
  ROUND(EXTRACT(EPOCH FROM (te.clock_out - te.clock_in)) / 3600, 2) as hours,
  te.created_at
FROM time_entries te
LEFT JOIN employees e ON te.employee_id = e.id
WHERE te.project_id = '4b441890-e5a2-4cbb-92c9-aabce5178ed1'
ORDER BY te.clock_in DESC;

-- Step 2: Find DUPLICATE entries (same employee, same clock_in time)
SELECT 
  te.employee_id,
  e.first_name || ' ' || e.last_name as employee,
  te.clock_in,
  te.clock_out,
  COUNT(*) as duplicate_count,
  array_agg(te.id) as entry_ids
FROM time_entries te
LEFT JOIN employees e ON te.employee_id = e.id
WHERE te.project_id = '4b441890-e5a2-4cbb-92c9-aabce5178ed1'
GROUP BY te.employee_id, e.first_name, e.last_name, te.clock_in, te.clock_out
HAVING COUNT(*) > 1;

-- Step 3: Find entries with VERY similar clock_in (within 2 hours of each other on same day)
-- This catches entries that might have slightly different times but are the same shift
SELECT 
  a.id as entry_a_id,
  b.id as entry_b_id,
  e.first_name || ' ' || e.last_name as employee,
  DATE(a.clock_in) as work_date,
  a.clock_in as a_start, a.clock_out as a_end,
  b.clock_in as b_start, b.clock_out as b_end,
  ROUND(EXTRACT(EPOCH FROM (a.clock_out - a.clock_in)) / 3600, 2) as a_hours,
  ROUND(EXTRACT(EPOCH FROM (b.clock_out - b.clock_in)) / 3600, 2) as b_hours
FROM time_entries a
JOIN time_entries b ON a.employee_id = b.employee_id 
  AND DATE(a.clock_in) = DATE(b.clock_in) 
  AND a.id < b.id
  AND a.project_id = b.project_id
LEFT JOIN employees e ON a.employee_id = e.id
WHERE a.project_id = '4b441890-e5a2-4cbb-92c9-aabce5178ed1';

-- Step 4: DELETE exact duplicates (keeping the OLDEST entry per employee per clock_in)
-- UNCOMMENT the lines below to actually delete duplicates:

 DELETE FROM time_entries 
 WHERE id IN (
   SELECT te.id
   FROM time_entries te
   INNER JOIN (
     SELECT employee_id, clock_in, clock_out, MIN(id) as keep_id
     FROM time_entries
     WHERE project_id = '4b441890-e5a2-4cbb-92c9-aabce5178ed1'
     GROUP BY employee_id, clock_in, clock_out
  HAVING COUNT(*) > 1
  ) dups ON te.employee_id = dups.employee_id 
   AND te.clock_in = dups.clock_in 
  AND te.clock_out = dups.clock_out
    AND te.id != dups.keep_id
 WHERE te.project_id = '4b441890-e5a2-4cbb-92c9-aabce5178ed1'
 );

-- Step 5: For entries on the same day with DIFFERENT times, 
-- keep only the one that matches the Time Clock History
-- You'll need to manually review these and delete the wrong ones
