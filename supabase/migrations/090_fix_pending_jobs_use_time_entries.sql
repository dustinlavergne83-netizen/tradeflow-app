-- ====================================
-- FIX PENDING JOBS - Query time_entries table directly
-- ====================================
-- This fixes the issue where unlinked time entries weren't showing in pending jobs
-- because they're stored in time_entries table, not shift_segments

-- Drop the old view
DROP VIEW IF EXISTS pending_jobs CASCADE;

-- Create a view that queries the time_entries table directly
CREATE OR REPLACE VIEW pending_jobs AS
SELECT 
  'UNLINKED - ' || DATE(te.clock_in) as project_task,
  COUNT(DISTINCT te.employee_id) as employee_count,
  COUNT(te.id) as segment_count,
  MIN(te.clock_in) as first_used,
  MAX(te.clock_in) as last_used,
  ROUND(SUM(
    CASE 
      WHEN te.clock_out IS NOT NULL 
      THEN EXTRACT(EPOCH FROM (te.clock_out - te.clock_in)) / 3600 
      ELSE 0 
    END
  )::numeric, 2) as total_hours,
  array_agg(DISTINCT COALESCE(te.employee_id::text, 'Unknown')) as employee_names
FROM time_entries te
WHERE te.project_id IS NULL
GROUP BY DATE(te.clock_in)
ORDER BY MAX(te.clock_in) DESC;

-- Grant access to view
GRANT SELECT ON pending_jobs TO authenticated;

COMMENT ON VIEW pending_jobs IS 'Shows all unlinked time entries from the time_entries table that need to be assigned to projects';
