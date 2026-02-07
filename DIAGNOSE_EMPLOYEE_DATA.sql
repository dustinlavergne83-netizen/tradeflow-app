-- ====================================
-- DIAGNOSE: Why employee data isn't showing
-- ====================================

-- 1. Check what's in time_entries table
SELECT 'TIME_ENTRIES SAMPLE:' as section;
SELECT 
  id,
  employee_id,
  clock_in,
  clock_out,
  project_id,
  (clock_out - clock_in) as duration
FROM time_entries
WHERE project_id IS NULL
LIMIT 5;

-- 2. Check employees table
SELECT 'EMPLOYEES TABLE:' as section;
SELECT 
  user_id,
  first_name,
  last_name,
  email
FROM employees
LIMIT 5;

-- 3. Try the JOIN - see what matches
SELECT 'JOIN TEST - time_entries LEFT JOIN employees:' as section;
SELECT 
  te.id as time_entry_id,
  te.employee_id,
  e.user_id,
  e.first_name,
  e.last_name,
  CASE 
    WHEN e.user_id IS NULL THEN 'NO MATCH'
    ELSE 'MATCH FOUND'
  END as join_status
FROM time_entries te
LEFT JOIN employees e ON te.employee_id = e.user_id
WHERE te.project_id IS NULL
LIMIT 10;

-- 4. Check what the current pending_jobs view returns
SELECT 'CURRENT PENDING_JOBS VIEW RESULTS:' as section;
SELECT * FROM pending_jobs LIMIT 5;

-- 5. Check if there's a different field that should be used for the join
SELECT 'EMPLOYEES COLUMNS:' as section;
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'employees'
ORDER BY ordinal_position;

-- 6. Check if employee_id in time_entries might be UUID
SELECT 'TIME_ENTRIES COLUMNS:' as section;
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'time_entries'
ORDER BY ordinal_position;
