-- EMERGENCY FIX - RUN THIS IMMEDIATELY IN SUPABASE SQL EDITOR
-- This restores the CORRECT pending jobs functionality

-- Step 1: DROP EVERYTHING FIRST (including old broken function)
DROP FUNCTION IF EXISTS link_pending_job_to_project(UUID, TEXT);
DROP FUNCTION IF EXISTS link_pending_job_to_project(TEXT, UUID);
DROP FUNCTION IF EXISTS rename_pending_job(TEXT, TEXT);
DROP VIEW IF EXISTS pending_jobs CASCADE;

-- Step 2: CREATE THE VIEW CORRECTLY
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
  array_agg(DISTINCT COALESCE(e.first_name || ' ' || e.last_name, 'Unknown')) FILTER (WHERE e.first_name IS NOT NULL OR te.employee_id IS NOT NULL) as employee_names,
  COALESCE(te.notes, 'UNLINKED - ' || DATE(te.clock_in)) as actual_job_key
FROM time_entries te
LEFT JOIN employees e ON te.employee_id = e.id
WHERE te.project_id IS NULL
GROUP BY COALESCE(te.notes, 'UNLINKED - ' || DATE(te.clock_in))
ORDER BY last_used DESC;

GRANT SELECT ON pending_jobs TO authenticated;

-- Step 3: CREATE THE CORRECTED FUNCTION
-- MUST match the UI call order: p_project_task FIRST, then p_project_id
CREATE OR REPLACE FUNCTION link_pending_job_to_project(
  p_project_task TEXT,
  p_project_id UUID
)
RETURNS INTEGER AS $$
DECLARE
  v_job_key TEXT;
  v_job_notes TEXT;
  v_job_date TEXT;
  v_updated_count INTEGER := 0;
BEGIN
  -- Extract the job key (everything before the parenthesis)
  -- e.g., "Mount Vernon Service Call (Ty Weldon)" -> "Mount Vernon Service Call"
  v_job_key := TRIM(SUBSTRING(p_project_task FROM 1 FOR POSITION('(' IN p_project_task) - 1));
  
  -- If there's no parenthesis, use the full string
  IF POSITION('(' IN p_project_task) = 0 THEN
    v_job_key := p_project_task;
  END IF;
  
  -- Check if this is an UNLINKED entry (starts with "UNLINKED - ")
  IF v_job_key LIKE 'UNLINKED - %' THEN
    -- Extract date: "UNLINKED - 2026-02-06" -> "2026-02-06"
    v_job_date := SUBSTRING(v_job_key FROM 12);
    
    -- Match entries with NULL notes AND matching date
    UPDATE time_entries
    SET project_id = p_project_id
    WHERE notes IS NULL
      AND DATE(clock_in) = v_job_date::DATE
      AND project_id IS NULL;
      
    GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  ELSE
    -- Match entries with exact notes value
    UPDATE time_entries
    SET project_id = p_project_id
    WHERE notes = v_job_key
      AND project_id IS NULL;
      
    GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  END IF;
  
  RETURN v_updated_count;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION rename_pending_job(
  p_old_name TEXT,
  p_new_name TEXT
)
RETURNS INTEGER AS $$
BEGIN
  RETURN 0;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION link_pending_job_to_project TO authenticated;
GRANT EXECUTE ON FUNCTION rename_pending_job TO authenticated;

-- ALL DONE! Refresh browser now
