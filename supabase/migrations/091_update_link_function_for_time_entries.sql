-- ====================================
-- UPDATE LINK FUNCTION for time_entries
-- ====================================
-- This updates the link_pending_job_to_project function to work with time_entries
-- that are grouped by date in the pending_jobs view

-- Drop old functions since they were designed for shift_segments
DROP FUNCTION IF EXISTS link_pending_job_to_project(UUID, TEXT);
DROP FUNCTION IF EXISTS link_pending_job_to_project(TEXT, UUID);
DROP FUNCTION IF EXISTS rename_pending_job(TEXT, TEXT);

-- Create new function that links ALL time entries matching a job name to a project
CREATE OR REPLACE FUNCTION link_pending_job_to_project(
  p_project_id UUID,
  p_project_task TEXT
)
RETURNS INTEGER AS $$
DECLARE
  v_actual_job_name TEXT;
  v_is_unlinked BOOLEAN;
  v_unlinked_date TEXT;
  v_updated_count INTEGER;
BEGIN
  -- The UI passes the full formatted string like "Richard Residence (Ty Weldon, John Smith)"
  -- But the actual notes value in time_entries is just "Richard Residence"
  -- So we need to extract just the job name part (before the parenthesis)
  v_actual_job_name := TRIM(SUBSTRING(p_project_task FROM 1 FOR POSITION('(' IN p_project_task) - 1));
  
  -- If there's no parenthesis, use the whole string
  IF POSITION('(' IN p_project_task) = 0 THEN
    v_actual_job_name := p_project_task;
  END IF;
  
  -- Check if this is an UNLINKED entry (starts with "UNLINKED - ")
  v_is_unlinked := (v_actual_job_name LIKE 'UNLINKED - %');
  
  IF v_is_unlinked THEN
    -- Extract the date part from "UNLINKED - YYYY-MM-DD"
    v_unlinked_date := SUBSTRING(v_actual_job_name FROM 12);  -- Skip "UNLINKED - " (11 chars)
    
    -- Update time_entries where notes IS NULL and clock_in date matches
    UPDATE time_entries
    SET project_id = p_project_id
    WHERE notes IS NULL
      AND DATE(clock_in) = v_unlinked_date::DATE
      AND project_id IS NULL;
  ELSE
    -- Update time_entries with matching notes value
    UPDATE time_entries
    SET project_id = p_project_id
    WHERE notes = v_actual_job_name
      AND project_id IS NULL;
  END IF;
  
  -- Get the actual row count updated
  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  
  RETURN v_updated_count;
END;
$$ LANGUAGE plpgsql;

-- Create new function that renames pending jobs (stub - not used anymore)
CREATE OR REPLACE FUNCTION rename_pending_job(
  p_old_name TEXT,
  p_new_name TEXT
)
RETURNS INTEGER AS $$
BEGIN
  -- This function no longer applies since dates can't be renamed
  -- Return 0 since no operation needed
  RETURN 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION link_pending_job_to_project TO authenticated;
GRANT EXECUTE ON FUNCTION rename_pending_job TO authenticated;
