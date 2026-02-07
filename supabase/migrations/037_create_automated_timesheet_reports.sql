-- Enable pg_cron extension
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Create table to store automated report settings
CREATE TABLE IF NOT EXISTS automated_timesheet_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_email TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  send_day INTEGER DEFAULT 1, -- 1 = Monday, 2 = Tuesday, etc.
  send_hour INTEGER DEFAULT 8, -- 8 AM
  send_timezone TEXT DEFAULT 'America/Chicago',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add RLS policies
ALTER TABLE automated_timesheet_reports ENABLE ROW LEVEL SECURITY;

-- Policy: Allow authenticated users to view automated reports
CREATE POLICY "Allow authenticated users to view automated reports" 
  ON automated_timesheet_reports
  FOR SELECT 
  TO authenticated 
  USING (true);

-- Policy: Allow authenticated users to insert automated reports
CREATE POLICY "Allow authenticated users to create automated reports" 
  ON automated_timesheet_reports
  FOR INSERT 
  TO authenticated 
  WITH CHECK (true);

-- Policy: Allow authenticated users to update automated reports
CREATE POLICY "Allow authenticated users to update automated reports" 
  ON automated_timesheet_reports
  FOR UPDATE 
  TO authenticated 
  USING (true);

-- Policy: Allow authenticated users to delete automated reports
CREATE POLICY "Allow authenticated users to delete automated reports" 
  ON automated_timesheet_reports
  FOR DELETE 
  TO authenticated 
  USING (true);

-- Create function to send weekly timesheets
CREATE OR REPLACE FUNCTION send_weekly_timesheet_reports()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  recipient RECORD;
  function_url TEXT;
BEGIN
  -- Get Supabase project URL from environment
  function_url := current_setting('app.settings.supabase_url', true) || '/functions/v1/send-automated-timesheet';
  
  -- Loop through all active recipients
  FOR recipient IN 
    SELECT recipient_email 
    FROM automated_timesheet_reports 
    WHERE is_active = true
  LOOP
    -- Call the Edge Function for each recipient
    PERFORM net.http_post(
      url := function_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
      ),
      body := jsonb_build_object(
        'recipient_email', recipient.recipient_email
      )
    );
  END LOOP;
END;
$$;

-- Schedule the function to run every Monday at 8 AM Central Time
-- Note: pg_cron uses UTC, so 8 AM Central (UTC-6) = 2 PM UTC
-- Adjust for daylight saving time as needed
SELECT cron.schedule(
  'send-weekly-timesheets',
  '0 14 * * 1', -- Every Monday at 2 PM UTC (8 AM Central)
  $$SELECT send_weekly_timesheet_reports();$$
);

-- Add comment
COMMENT ON TABLE automated_timesheet_reports IS 'Stores email addresses for automated weekly timesheet reports';
COMMENT ON FUNCTION send_weekly_timesheet_reports() IS 'Sends weekly timesheet reports to all active recipients';
