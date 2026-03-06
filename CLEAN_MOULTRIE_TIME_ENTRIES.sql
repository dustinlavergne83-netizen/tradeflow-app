-- ====================================
-- CLEAN: Keep only the 3 correct Moultrie time entries
-- ====================================
-- Keep:
--   Feb 5, 2026: 06:00 AM → 10:42 PM (16.71h)
--   Feb 3, 2026: 06:15 AM → 09:43 PM (15.48h)
--   Feb 2, 2026: 06:00 AM → 05:15 PM (11.25h)
-- Delete all other entries for this project.

-- Step 1: Preview what will be DELETED (run this first to verify)
SELECT 
  te.id,
  e.first_name || ' ' || e.last_name as employee,
  te.clock_in,
  te.clock_out,
  ROUND(EXTRACT(EPOCH FROM (te.clock_out - te.clock_in)) / 3600, 2) as hours,
  'WILL BE DELETED' as action
FROM time_entries te
LEFT JOIN employees e ON te.employee_id = e.id
WHERE te.project_id = '4b441890-e5a2-4cbb-92c9-aabce5178ed1'
  AND te.id NOT IN (
    -- Keep the 3 correct entries (matching by exact date + times)
    SELECT id FROM time_entries 
    WHERE project_id = '4b441890-e5a2-4cbb-92c9-aabce5178ed1'
      AND (
        (DATE(clock_in) = '2026-02-05' AND clock_in::time BETWEEN '05:55' AND '06:05' AND clock_out::time BETWEEN '22:37' AND '22:47')
        OR (DATE(clock_in) = '2026-02-03' AND clock_in::time BETWEEN '06:10' AND '06:20' AND clock_out::time BETWEEN '21:38' AND '21:48')
        OR (DATE(clock_in) = '2026-02-02' AND clock_in::time BETWEEN '05:55' AND '06:05' AND clock_out::time BETWEEN '17:10' AND '17:20')
      )
  );

-- Step 2: DELETE the bad entries (run after verifying Step 1 looks right)
DELETE FROM time_entries
WHERE project_id = '4b441890-e5a2-4cbb-92c9-aabce5178ed1'
  AND id NOT IN (
    SELECT id FROM time_entries 
    WHERE project_id = '4b441890-e5a2-4cbb-92c9-aabce5178ed1'
      AND (
        (DATE(clock_in) = '2026-02-05' AND clock_in::time BETWEEN '05:55' AND '06:05' AND clock_out::time BETWEEN '22:37' AND '22:47')
        OR (DATE(clock_in) = '2026-02-03' AND clock_in::time BETWEEN '06:10' AND '06:20' AND clock_out::time BETWEEN '21:38' AND '21:48')
        OR (DATE(clock_in) = '2026-02-02' AND clock_in::time BETWEEN '05:55' AND '06:05' AND clock_out::time BETWEEN '17:10' AND '17:20')
      )
  );
