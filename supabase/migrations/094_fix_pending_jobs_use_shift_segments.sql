-- ====================================
-- FIX: Restore pending_jobs view to use shift_segments (correct data source)
-- ====================================
-- Migrations 089/090/093 switched to time_entries which has wrong hour totals.
-- The shift_segments table has the correct per-project time breakdowns.

DROP VIEW IF EXISTS pending_jobs CASCADE;

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
  array_agg(DISTINCT e.first_name || ' ' || e.last_name) 
    FILTER (WHERE e.first_name IS NOT NULL) as employee_names
FROM shift_segments ss
LEFT JOIN employees e ON ss.user_id = e.user_id
WHERE ss.project_task IS NOT NULL 
  AND ss.project_task != ''
  AND ss.project_id IS NULL
GROUP BY ss.project_task
ORDER BY MAX(ss.start_at) DESC;

-- Grant access
GRANT SELECT ON pending_jobs TO authenticated;

-- Drop old link functions (both signatures)
DROP FUNCTION IF EXISTS link_pending_job_to_project(UUID, TEXT);
DROP FUNCTION IF EXISTS link_pending_job_to_project(TEXT, UUID);

-- Recreate link function to update shift_segments
CREATE OR REPLACE FUNCTION link_pending_job_to_project(
  p_project_task TEXT,
  p_project_id UUID
)
RETURNS INTEGER AS $$
DECLARE
  v_updated_count INTEGER;
BEGIN
  -- Update shift_segments with this project_task to point to the real project
  UPDATE shift_segments
  SET project_id = p_project_id
  WHERE project_task = p_project_task
    AND project_id IS NULL;
  
  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  
  -- Also update any matching time_entries
  UPDATE time_entries
  SET project_id = p_project_id
  WHERE notes = p_project_task
    AND project_id IS NULL;
  
  RETURN v_updated_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop old rename function
DROP FUNCTION IF EXISTS rename_pending_job(TEXT, TEXT);

-- Recreate rename function for shift_segments
CREATE OR REPLACE FUNCTION rename_pending_job(
  p_old_name TEXT,
  p_new_name TEXT
)
RETURNS INTEGER AS $$
DECLARE
  v_updated_count INTEGER;
BEGIN
  UPDATE shift_segments
  SET project_task = p_new_name
  WHERE project_task = p_old_name
    AND project_id IS NULL;
  
  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  
  -- Also update matching time_entries
  UPDATE time_entries
  SET notes = p_new_name
  WHERE notes = p_old_name
    AND project_id IS NULL;
  
  RETURN v_updated_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION link_pending_job_to_project(TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION rename_pending_job(TEXT, TEXT) TO authenticated;

COMMENT ON VIEW pending_jobs IS 'Shows unlinked shift segments grouped by project_task name. Uses shift_segments for accurate per-project hours.';
