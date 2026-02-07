-- ====================================
-- COMPLETE FIX: Pending Jobs View + Link Function
-- ====================================
-- Migration 090 overwrote migration 089 and broke the pending_jobs view
-- by removing the notes (project name) grouping. This migration fixes everything.

-- Drop the broken view
DROP VIEW IF EXISTS pending_jobs CASCADE;

-- Recreate the view properly - groups by the project name the employee typed (notes field)
-- If no notes, groups by date as "UNLINKED - YYYY-MM-DD"
CREATE OR REPLACE VIEW pending_jobs AS
SELECT 
  COALESCE(te.notes, 'UNLINKED - ' || DATE(te.clock_in)) as project_task,
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
  array_agg(DISTINCT COALESCE(e.first_name || ' ' || e.last_name, 'Unknown')) 
    FILTER (WHERE e.first_name IS NOT NULL) as employee_names
FROM time_entries te
LEFT JOIN employees e ON te.employee_id = e.id
WHERE te.project_id IS NULL
GROUP BY COALESCE(te.notes, 'UNLINKED - ' || DATE(te.clock_in))
ORDER BY MAX(te.clock_in) DESC;

-- Grant access
GRANT SELECT ON pending_jobs TO authenticated;

-- Drop old link functions
DROP FUNCTION IF EXISTS link_pending_job_to_project(UUID, TEXT);
DROP FUNCTION IF EXISTS link_pending_job_to_project(TEXT, UUID);

-- Recreate the link function - simple and clean
-- p_project_task matches the project_task column from the pending_jobs view
-- which is either the notes value (e.g. "Richard Residence") or "UNLINKED - 2026-02-07"
CREATE OR REPLACE FUNCTION link_pending_job_to_project(
  p_project_id UUID,
  p_project_task TEXT
)
RETURNS INTEGER AS $$
DECLARE
  v_updated_count INTEGER;
  v_is_unlinked BOOLEAN;
  v_unlinked_date TEXT;
BEGIN
  -- Check if this is an UNLINKED entry (no project name was entered)
  v_is_unlinked := (p_project_task LIKE 'UNLINKED - %');
  
  IF v_is_unlinked THEN
    -- Extract the date part from "UNLINKED - YYYY-MM-DD"
    v_unlinked_date := SUBSTRING(p_project_task FROM 12);
    
    -- Update time_entries where notes IS NULL and clock_in date matches
    UPDATE time_entries
    SET project_id = p_project_id
    WHERE notes IS NULL
      AND DATE(clock_in) = v_unlinked_date::DATE
      AND project_id IS NULL;
  ELSE
    -- Update time_entries where notes matches the project name exactly
    UPDATE time_entries
    SET project_id = p_project_id
    WHERE notes = p_project_task
      AND project_id IS NULL;
  END IF;
  
  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  RETURN v_updated_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute
GRANT EXECUTE ON FUNCTION link_pending_job_to_project(UUID, TEXT) TO authenticated;

COMMENT ON VIEW pending_jobs IS 'Shows unlinked time entries grouped by project name (notes) or date. Used to link employee time entries to actual projects.';
