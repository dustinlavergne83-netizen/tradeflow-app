-- DIAGNOSE TIME ENTRIES FOR RICHARD RESIDENCE

-- First, find the Richard Residence project ID
SELECT id, name FROM projects WHERE name LIKE '%richard%' OR name LIKE '%residence%';

-- Then, count all time entries for that project
-- Replace PROJECT_ID with the actual ID from above
SELECT COUNT(*) as total_entries FROM time_entries WHERE project_id = 'PROJECT_ID';

-- Show all time entries for Richard Residence (no limit)
SELECT 
  id,
  project_id,
  employee_name,
  clock_in,
  clock_out,
  CASE 
    WHEN clock_out IS NULL THEN 'Still clocked in'
    ELSE ROUND(EXTRACT(EPOCH FROM (clock_out - clock_in))/3600, 2) || ' hours'
  END as duration,
  created_at,
  updated_at
FROM time_entries 
WHERE project_id = 'PROJECT_ID'
ORDER BY clock_in DESC;

-- Check if there are any entries with NULL project_id that might belong to Richard Residence
SELECT 
  id,
  project_id,
  employee_name,
  clock_in,
  clock_out
FROM time_entries 
WHERE project_id IS NULL
LIMIT 20;

-- Check the time_entries table structure
SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'time_entries';
