-- ====================================
-- FIX PENDING JOBS VIEW - Show ALL Unlinked Time Entries from time_entries
-- ====================================
-- This migration fixes the pending_jobs view to query the time_entries table
-- where unlinked time entries are actually stored

-- Drop the old view since we're recreating it
DROP VIEW IF EXISTS pending_jobs CASCADE;

-- Create a new view that queries time_entries (NOT shift_segments)
-- Shows the actual project_task name employees entered + employee names
CREATE OR REPLACE VIEW pending_jobs AS
SELECT 
  COALESCE(te.notes, 'UNLINKED - ' || DATE(te.clock_in)) || ' (' || STRING_AGG(DISTINCT COALESCE(e.first_name || ' ' || e.last_name, 'Unknown'), ', ') || ')' as project_task,
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
  array_agg(DISTINCT COALESCE(e.first_name || ' ' || e.last_name, 'Unknown')) FILTER (WHERE e.first_name IS NOT NULL OR te.employee_id IS NOT NULL) as employee_names
FROM time_entries te
LEFT JOIN employees e ON te.employee_id = e.id
WHERE te.project_id IS NULL  -- Only show unlinked entries
GROUP BY COALESCE(te.notes, 'UNLINKED - ' || DATE(te.clock_in))
ORDER BY last_used DESC;

-- Grant access to view
GRANT SELECT ON pending_jobs TO authenticated;

COMMENT ON VIEW pending_jobs IS 'Shows all unlinked time entries from time_entries table that need to be assigned to projects';
