-- STEP 1: Find Ty Weldon's employee record
SELECT id, first_name, last_name, email 
FROM employees 
WHERE first_name ILIKE '%ty%' OR last_name ILIKE '%weldon%';

-- STEP 2: Find ALL shift_segments for Ty Weldon (use his user_id from step 1)
-- Replace USER_ID_HERE with the actual ID
SELECT ss.id, ss.user_id, ss.project_id, ss.start_at, ss.end_at, ss.project_task,
       p.name as project_name
FROM shift_segments ss
LEFT JOIN projects p ON p.id = ss.project_id
WHERE ss.user_id IN (
  SELECT id FROM employees WHERE first_name ILIKE '%ty%' OR last_name ILIKE '%weldon%'
)
ORDER BY ss.start_at DESC
LIMIT 20;

-- STEP 3: Check if there are time_entries (old table) for Ty Weldon that weren't migrated
SELECT te.id, te.user_id, te.project_id, te.clock_in, te.clock_out, te.project_task,
       p.name as project_name
FROM time_entries te
LEFT JOIN projects p ON p.id = te.project_id
WHERE te.user_id IN (
  SELECT id FROM employees WHERE first_name ILIKE '%ty%' OR last_name ILIKE '%weldon%'
)
ORDER BY te.clock_in DESC
LIMIT 20;

-- STEP 4: Find shift_segments with NULL project_id that might belong to a project
SELECT ss.id, ss.user_id, ss.start_at, ss.end_at, ss.project_task, ss.project_id,
       e.first_name, e.last_name
FROM shift_segments ss
JOIN employees e ON e.id = ss.user_id
WHERE ss.project_id IS NULL
AND (e.first_name ILIKE '%ty%' OR e.last_name ILIKE '%weldon%')
ORDER BY ss.start_at DESC
LIMIT 20;

-- STEP 5: Show all projects to find the right project_id
SELECT id, name FROM projects ORDER BY name;
