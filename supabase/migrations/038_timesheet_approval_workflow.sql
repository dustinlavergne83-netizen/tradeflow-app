-- Timesheet Approval Workflow System
-- Allows review and approval before sending automated reports

-- Create pending reports table
CREATE TABLE IF NOT EXISTS pending_timesheet_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  week_start DATE NOT NULL,
  week_end DATE NOT NULL,
  status TEXT DEFAULT 'pending', -- 'pending', 'approved', 'rejected', 'sent'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  reviewed_by UUID REFERENCES auth.users(id),
  sent_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  report_data JSONB, -- Store the actual timesheet data
  UNIQUE(week_start, week_end)
);

-- Add approval settings
ALTER TABLE automated_timesheet_reports 
  ADD COLUMN IF NOT EXISTS requires_approval BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS approver_email TEXT;

-- Enable RLS
ALTER TABLE pending_timesheet_reports ENABLE ROW LEVEL SECURITY;

-- Policies for pending reports
CREATE POLICY "Authenticated users can view pending reports"
  ON pending_timesheet_reports FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can update pending reports"
  ON pending_timesheet_reports FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert pending reports"
  ON pending_timesheet_reports FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Update the automated function to create pending reports instead
CREATE OR REPLACE FUNCTION create_pending_weekly_timesheet()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  last_monday DATE;
  last_sunday DATE;
  function_url TEXT;
  requires_review BOOLEAN;
BEGIN
  -- Calculate last week's dates
  last_monday := (CURRENT_DATE - INTERVAL '1 week')::DATE - 
                 ((EXTRACT(DOW FROM CURRENT_DATE - INTERVAL '1 week')::INT + 6) % 7);
  last_sunday := last_monday + INTERVAL '6 days';
  
  -- Check if approval is required
  SELECT COALESCE(bool_or(requires_approval), true) INTO requires_review
  FROM automated_timesheet_reports
  WHERE is_active = true;
  
  IF requires_review THEN
    -- Create pending report for review
    INSERT INTO pending_timesheet_reports (week_start, week_end, status)
    VALUES (last_monday, last_sunday, 'pending')
    ON CONFLICT (week_start, week_end) DO NOTHING;
    
    -- Send notification to approver
    function_url := current_setting('app.settings.supabase_url', true) || '/functions/v1/send-approval-notification';
    
    PERFORM net.http_post(
      url := function_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
      ),
      body := jsonb_build_object(
        'week_start', last_monday,
        'week_end', last_sunday
      )
    );
  ELSE
    -- Send automatically without approval
    function_url := current_setting('app.settings.supabase_url', true) || '/functions/v1/send-automated-timesheet';
    
    PERFORM net.http_post(
      url := function_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
      ),
      body := jsonb_build_object()
    );
  END IF;
END;
$$;

-- Update the cron job to use the new function
SELECT cron.unschedule('send-weekly-timesheets');

SELECT cron.schedule(
  'create-pending-timesheets',
  '0 14 * * 1', -- Every Monday at 2 PM UTC (8 AM Central)
  $$SELECT create_pending_weekly_timesheet();$$
);

-- Function to approve and send report
CREATE OR REPLACE FUNCTION approve_and_send_timesheet(report_id UUID, user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  function_url TEXT;
  week_start_val DATE;
  week_end_val DATE;
BEGIN
  -- Update report status
  UPDATE pending_timesheet_reports
  SET 
    status = 'approved',
    reviewed_at = NOW(),
    reviewed_by = user_id
  WHERE id = report_id
  RETURNING week_start, week_end INTO week_start_val, week_end_val;
  
  -- Trigger send function
  function_url := current_setting('app.settings.supabase_url', true) || '/functions/v1/send-approved-timesheet';
  
  PERFORM net.http_post(
    url := function_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := jsonb_build_object(
      'report_id', report_id,
      'week_start', week_start_val,
      'week_end', week_end_val
    )
  );
  
  -- Mark as sent
  UPDATE pending_timesheet_reports
  SET status = 'sent', sent_at = NOW()
  WHERE id = report_id;
END;
$$;

COMMENT ON TABLE pending_timesheet_reports IS 'Stores weekly timesheets pending approval';
COMMENT ON FUNCTION create_pending_weekly_timesheet() IS 'Creates pending timesheet reports for approval';
COMMENT ON FUNCTION approve_and_send_timesheet(UUID, UUID) IS 'Approves and sends a pending timesheet report';
