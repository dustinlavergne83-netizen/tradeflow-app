-- ====================================
-- DEBUG: Check if time_entries exist and pending_jobs view works
-- ====================================

-- 1. Check if unlinked time_entries exist
SELECT 'UNLINKED TIME ENTRIES:' as check;
SELECT COUNT(*) as total_unlinked,
       COUNT(DISTINCT employee_id) as unique_employees,
       COUNT(DISTINCT DATE(clock_in)) as unique_dates
FROM time_entries
WHERE project_id IS NULL;

-- Show the unlinked entries
SELECT 
  id,
  employee_id,
  DATE(clock_in) as entry_date,
  clock_in,
  clock_out,
  project_id,
  EXTRACT(EPOCH FROM (clock_out - clock_in)) / 3600 as hours
FROM time_entries
WHERE project_id IS NULL
ORDER BY clock_in DESC
LIMIT 20;

-- 2. Check if pending_jobs view exists
SELECT 'PENDING_JOBS VIEW:' as check;
SELECT EXISTS(
  SELECT 1 FROM information_schema.tables 
  WHERE table_schema='public' AND table_name='pending_jobs' AND table_type='VIEW'
) as view_exists;

-- 3. Try to query the view directly
SELECT 'QUERY RESULT FROM pending_jobs VIEW:' as check;
SELECT * FROM pending_jobs;

-- 4. Check RLS policy on time_entries table
SELECT 'RLS POLICIES ON time_entries:' as check;
SELECT schemaname, tablename, policyname, permissive, roles, qual, with_check
FROM pg_policies
WHERE tablename = 'time_entries'
AND schemaname = 'public';

-- 5. Check view permissions
SELECT 'VIEW COLUMN INFO:' as check;
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'pending_jobs'
AND table_schema = 'public'
ORDER BY ordinal_position;
