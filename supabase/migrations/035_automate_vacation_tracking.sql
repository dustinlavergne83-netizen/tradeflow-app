-- Add columns to shifts table for vacation tracking
ALTER TABLE shifts 
  ADD COLUMN IF NOT EXISTS is_vacation BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS vacation_counted BOOLEAN DEFAULT FALSE;

-- Add index for vacation shift queries
CREATE INDEX IF NOT EXISTS idx_shifts_vacation ON shifts(user_id, is_vacation, clock_in) WHERE is_vacation = TRUE;

-- Drop existing trigger and function if they exist
DROP TRIGGER IF EXISTS trigger_create_vacation_shifts ON time_off_requests;
DROP FUNCTION IF EXISTS create_vacation_shifts();

-- Create function to auto-create shift records when time off is approved
CREATE OR REPLACE FUNCTION create_vacation_shifts()
RETURNS TRIGGER AS $$
DECLARE
  loop_date DATE;
  daily_hours DECIMAL;
BEGIN
  -- Only create shifts if status changed to approved
  IF NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status != 'approved') THEN
    -- Calculate hours per day
    daily_hours := NEW.hours_requested / (NEW.end_date - NEW.start_date + 1);
    
    -- Create shift records for each day in the range
    loop_date := NEW.start_date;
    WHILE loop_date <= NEW.end_date LOOP
      INSERT INTO shifts (user_id, clock_in, clock_out, total_hours, is_vacation)
      VALUES (
        NEW.user_id,
        loop_date + TIME '08:00:00',  -- 8 AM clock in
        loop_date + TIME '08:00:00' + (daily_hours || ' hours')::INTERVAL,  -- Clock out based on hours
        daily_hours,
        TRUE  -- Mark as vacation
      )
      ON CONFLICT DO NOTHING;  -- Skip if shift already exists for that time
      
      loop_date := loop_date + 1;
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
      AND COALESCE(s.vacation_counted, FALSE) = FALSE  -- Not yet counted
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
      AND COALESCE(vacation_counted, FALSE) = FALSE;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Try to enable pg_cron extension (may fail if not available, that's OK)
DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_cron;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'pg_cron extension not available - vacation deduction will need to be run manually or via Edge Function';
END
$$;

-- Try to schedule the cron job (will fail gracefully if pg_cron not available)
DO $$
BEGIN
  PERFORM cron.schedule(
    'deduct-past-vacation-hours',
    '0 0 * * *',  -- Every day at midnight
    'SELECT deduct_past_vacation_hours();'
  );
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Could not schedule cron job - pg_cron may not be available';
END
$$;

-- Add comment
COMMENT ON FUNCTION deduct_past_vacation_hours() IS 'Automatically deducts vacation hours for past vacation days. Should be called daily via cron job or Edge Function.';
