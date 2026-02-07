-- ====================================
-- PENDING JOBS MANAGEMENT
-- ====================================
-- This migration creates a view and helper functions to manage
-- temporary/pending job names that employees enter when clocking in
-- before projects are officially created in the system.

-- Create a view that shows all unique project_task names that don't have a matching project
CREATE OR REPLACE VIEW pending_jobs AS
SELECT 
  ss.project_task,
  COUNT(DISTINCT ss.user_id) as employee_count,
  COUNT(ss.id) as segment_count,
  MIN(ss.start_at) as first_used,
  MAX(ss.start_at) as last_used,
  ROUND(SUM(
    CASE 
      WHEN ss.end_at IS NOT NULL 
      THEN EXTRACT(EPOCH FROM (ss.end_at - ss.start_at)) / 3600 
      ELSE 0 
    END
  )::numeric, 2) as total_hours,
  array_agg(DISTINCT e.first_name || ' ' || e.last_name) FILTER (WHERE e.first_name IS NOT NULL) as employee_names
FROM shift_segments ss
LEFT JOIN employees e ON ss.user_id = e.user_id
WHERE ss.project_task IS NOT NULL 
  AND ss.project_task != ''
  AND ss.project_id IS NULL  -- No link to actual project yet
GROUP BY ss.project_task
ORDER BY last_used DESC;

-- Grant access to view
GRANT SELECT ON pending_jobs TO authenticated;

-- Function to link a pending job name to an actual project
CREATE OR REPLACE FUNCTION link_pending_job_to_project(
  p_project_task TEXT,
  p_project_id UUID
)
RETURNS INTEGER AS $$
DECLARE
  v_updated_count INTEGER;
BEGIN
  -- Update all shift_segments with this project_task to point to the real project
  UPDATE shift_segments
  SET project_id = p_project_id
  WHERE project_task = p_project_task
    AND project_id IS NULL;
  
  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  
  RETURN v_updated_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to rename a pending job (fix typos, etc.)
CREATE OR REPLACE FUNCTION rename_pending_job(
  p_old_name TEXT,
  p_new_name TEXT
)
RETURNS INTEGER AS $$
DECLARE
  v_updated_count INTEGER;
BEGIN
  -- Update all shift_segments with old name to new name
  UPDATE shift_segments
  SET project_task = p_new_name
  WHERE project_task = p_old_name
    AND project_id IS NULL;
  
  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  
  RETURN v_updated_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION link_pending_job_to_project TO authenticated;
GRANT EXECUTE ON FUNCTION rename_pending_job TO authenticated;

COMMENT ON VIEW pending_jobs IS 'Shows all temporary job names entered by employees that havent been linked to actual projects yet';
COMMENT ON FUNCTION link_pending_job_to_project IS 'Links all shift segments with a pending job name to an actual project';
COMMENT ON FUNCTION rename_pending_job IS 'Renames a pending job name (useful for fixing typos or standardizing names)';
