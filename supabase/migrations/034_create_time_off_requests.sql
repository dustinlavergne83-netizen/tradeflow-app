-- Create time off requests table
CREATE TABLE IF NOT EXISTS time_off_requests (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  hours_requested DECIMAL(8,2) NOT NULL,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied')),
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMPTZ,
  denial_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add RLS policies
ALTER TABLE time_off_requests ENABLE ROW LEVEL SECURITY;

-- Employees can view their own requests
CREATE POLICY "Employees can view own requests"
  ON time_off_requests
  FOR SELECT
  USING (auth.uid() = user_id);

-- Employees can create their own requests
CREATE POLICY "Employees can create own requests"
  ON time_off_requests
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Employees can update their own pending requests
CREATE POLICY "Employees can update own pending requests"
  ON time_off_requests
  FOR UPDATE
  USING (auth.uid() = user_id AND status = 'pending')
  WITH CHECK (auth.uid() = user_id AND status = 'pending');

-- Admins can view all requests
CREATE POLICY "Admins can view all requests"
  ON time_off_requests
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM employees
      WHERE employees.user_id = auth.uid()
      AND employees.role = 'admin'
    )
  );

-- Admins can approve/deny requests
CREATE POLICY "Admins can update requests"
  ON time_off_requests
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM employees
      WHERE employees.user_id = auth.uid()
      AND employees.role = 'admin'
    )
  );

-- Create function to auto-create shift records when time off is approved
CREATE OR REPLACE FUNCTION create_vacation_shifts()
RETURNS TRIGGER AS $$
DECLARE
  current_date DATE;
  daily_hours DECIMAL;
BEGIN
  -- Only create shifts if status changed to approved
  IF NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status != 'approved') THEN
    -- Calculate hours per day
    daily_hours := NEW.hours_requested / (NEW.end_date - NEW.start_date + 1);
    
    -- Create shift records for each day in the range
    current_date := NEW.start_date;
    WHILE current_date <= NEW.end_date LOOP
      INSERT INTO shifts (user_id, clock_in, clock_out, total_hours, is_vacation)
      VALUES (
        NEW.user_id,
        current_date + TIME '08:00:00',  -- 8 AM clock in
        current_date + TIME '08:00:00' + (daily_hours || ' hours')::INTERVAL,  -- Clock out based on hours
        daily_hours,
        TRUE  -- Mark as vacation
      )
      ON CONFLICT DO NOTHING;  -- Skip if shift already exists for that time
      
      current_date := current_date + 1;
    END LOOP;
  END IF;
  
  -- If changing from approved to denied/pending, delete the vacation shifts
  IF OLD.status = 'approved' AND NEW.status != 'approved' THEN
    DELETE FROM shifts
    WHERE user_id = NEW.user_id
      AND is_vacation = TRUE
      AND DATE(clock_in) >= NEW.start_date
      AND DATE(clock_in) <= NEW.end_date;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger
CREATE TRIGGER trigger_create_vacation_shifts
  AFTER INSERT OR UPDATE OF status
  ON time_off_requests
  FOR EACH ROW
  EXECUTE FUNCTION create_vacation_shifts();

-- Create function to auto-deduct vacation hours for past vacation days
CREATE OR REPLACE FUNCTION deduct_past_vacation_hours()
RETURNS void AS $$
DECLARE
  vacation_record RECORD;
  hours_to_deduct DECIMAL;
BEGIN
  -- Find all approved vacation shifts that have passed but haven't been counted yet
  FOR vacation_record IN
    SELECT 
      s.user_id,
      e.id as employee_id,
      SUM(s.total_hours) as total_hours
    FROM shifts s
    JOIN employees e ON e.user_id = s.user_id
    WHERE s.is_vacation = TRUE
      AND DATE(s.clock_in) < CURRENT_DATE  -- Only past days
      AND s.vacation_counted IS NOT TRUE  -- Not yet counted
    GROUP BY s.user_id, e.id
  LOOP
    -- Update employee's vacation hours used
    UPDATE employees
    SET vacation_hours_used = COALESCE(vacation_hours_used, 0) + vacation_record.total_hours
    WHERE id = vacation_record.employee_id;
    
    -- Mark those shifts as counted
    UPDATE shifts
    SET vacation_counted = TRUE
    WHERE user_id = vacation_record.user_id
      AND is_vacation = TRUE
      AND DATE(clock_in) < CURRENT_DATE
      AND vacation_counted IS NOT TRUE;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add columns to shifts table if they don't exist
ALTER TABLE shifts 
  ADD COLUMN IF NOT EXISTS is_vacation BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS vacation_counted BOOLEAN DEFAULT FALSE;

-- Add index for vacation shift queries
CREATE INDEX IF NOT EXISTS idx_shifts_vacation ON shifts(user_id, is_vacation, clock_in) WHERE is_vacation = TRUE;

-- Create a cron job to run daily deduction (requires pg_cron extension)
-- Note: This requires the pg_cron extension to be enabled in Supabase
-- Alternatively, you can call this function manually or via a scheduled Edge Function
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule the function to run daily at midnight
SELECT cron.schedule(
  'deduct-past-vacation-hours',
  '0 0 * * *',  -- Every day at midnight
  'SELECT deduct_past_vacation_hours();'
);

-- Add index for performance
CREATE INDEX idx_time_off_requests_user_id ON time_off_requests(user_id);
CREATE INDEX idx_time_off_requests_employee_id ON time_off_requests(employee_id);
CREATE INDEX idx_time_off_requests_status ON time_off_requests(status);

-- Add comments
COMMENT ON TABLE time_off_requests IS 'Employee time off requests with approval workflow';
COMMENT ON COLUMN time_off_requests.hours_requested IS 'Number of vacation hours requested (usually 8 per day)';
COMMENT ON COLUMN time_off_requests.status IS 'Request status: pending, approved, or denied';
