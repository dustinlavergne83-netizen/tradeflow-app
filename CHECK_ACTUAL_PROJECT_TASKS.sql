-- ====================================
-- CHECK: What project names/tasks did employees actually enter?
-- ====================================
-- Run this to see the actual project_task values stored in time_entries

SELECT 
  te.project_task,
  COUNT(*) as number_of_entries,
  COUNT(DISTINCT te.employee_id) as unique_employees,
  COUNT(DISTINCT DATE(te.clock_in)) as unique_dates,
  MIN(te.clock_in) as first_entry,
  MAX(te.clock_in) as last_entry,
  ROUND(SUM(
    CASE 
      WHEN te.clock_out IS NOT NULL 
      THEN EXTRACT(EPOCH FROM (te.clock_out - te.clock_in)) / 3600 
      ELSE 0 
    END
  )::numeric, 2) as total_hours
FROM time_entries te
WHERE te.project_id IS NULL
GROUP BY te.project_task
ORDER BY MAX(te.clock_in) DESC, COUNT(*) DESC;

-- If you want to see WHO entered each project_task:
SELECT 
  te.project_task,
  STRING_AGG(DISTINCT CONCAT(e.first_name, ' ', e.last_name), ', ') as employees,
  COUNT(*) as entries,
  ROUND(SUM(
    CASE 
      WHEN te.clock_out IS NOT NULL 
      THEN EXTRACT(EPOCH FROM (te.clock_out - te.clock_in)) / 3600 
      ELSE 0 
    END
  )::numeric, 2) as total_hours
FROM time_entries te
LEFT JOIN employees e ON te.employee_id = e.id
WHERE te.project_id IS NULL
GROUP BY te.project_task
ORDER BY MAX(te.clock_in) DESC, COUNT(*) DESC;
