-- Create company holidays table
CREATE TABLE IF NOT EXISTS company_holidays (
  id BIGSERIAL PRIMARY KEY,
  holiday_name TEXT NOT NULL,
  holiday_date DATE NOT NULL UNIQUE,
  hours_paid DECIMAL(8,2) DEFAULT 8.00,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add RLS policies for holidays table
ALTER TABLE company_holidays ENABLE ROW LEVEL SECURITY;

-- Everyone can view holidays
CREATE POLICY "Everyone can view holidays"
  ON company_holidays
  FOR SELECT
  USING (TRUE);

-- Only admins can manage holidays
CREATE POLICY "Admins can manage holidays"
  ON company_holidays
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM employees
      WHERE employees.user_id = auth.uid()
      AND employees.role = 'admin'
    )
  );

-- Add is_holiday column to shifts table
ALTER TABLE shifts 
  ADD COLUMN IF NOT EXISTS is_holiday BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS holiday_id BIGINT REFERENCES company_holidays(id);

-- Create index for holiday queries
CREATE INDEX IF NOT EXISTS idx_shifts_holiday ON shifts(user_id, is_holiday, clock_in) WHERE is_holiday = TRUE;

-- Function to create holiday shifts for eligible employees (after 1 year)
CREATE OR REPLACE FUNCTION create_holiday_shifts()
RETURNS void AS $$
DECLARE
  holiday_record RECORD;
  employee_record RECORD;
BEGIN
  -- Find holidays for today that haven't been processed yet
  FOR holiday_record IN
    SELECT id, holiday_name, holiday_date, hours_paid
    FROM company_holidays
    WHERE holiday_date = CURRENT_DATE
      AND is_active = TRUE
      AND NOT EXISTS (
        SELECT 1 FROM shifts
        WHERE is_holiday = TRUE
        AND DATE(clock_in) = holiday_date
        LIMIT 1  -- Just check if any holiday shifts exist for this date
      )
  LOOP
    -- Create holiday shift for each eligible employee (active, not archived, and employed for 1+ year)
    FOR employee_record IN
      SELECT user_id
      FROM employees
      WHERE is_active = TRUE
        AND archived IS NOT TRUE
        AND hire_date IS NOT NULL
        AND hire_date <= CURRENT_DATE - INTERVAL '1 year'  -- Must be employed for at least 1 year
    LOOP
      INSERT INTO shifts (
        user_id,
        clock_in,
        clock_out,
        total_hours,
        is_holiday,
        holiday_id
      )
      VALUES (
        employee_record.user_id,
        holiday_record.holiday_date + TIME '08:00:00',
        holiday_record.holiday_date + TIME '08:00:00' + (holiday_record.hours_paid || ' hours')::INTERVAL,
        holiday_record.hours_paid,
        TRUE,
        holiday_record.id
      )
      ON CONFLICT DO NOTHING;
    END LOOP;
    
    RAISE NOTICE 'Created holiday shifts for: %', holiday_record.holiday_name;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Try to schedule the holiday creation to run daily
DO $$
BEGIN
  -- Remove existing job if it exists
  PERFORM cron.unschedule('create-holiday-shifts');
EXCEPTION
  WHEN OTHERS THEN NULL;
END
$$;

DO $$
BEGIN
  PERFORM cron.schedule(
    'create-holiday-shifts',
    '0 1 * * *',  -- Every day at 1 AM (after midnight deduction runs)
    'SELECT create_holiday_shifts();'
  );
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Could not schedule holiday cron job - pg_cron may not be available';
END
$$;

-- Insert your company's paid holidays for 2025 and 2026
INSERT INTO company_holidays (holiday_name, holiday_date, hours_paid) VALUES
  -- 2025 Holidays
  ('New Year''s Day 2025', '2025-01-01', 8.00),
  ('Independence Day 2025', '2025-07-04', 8.00),
  ('Labor Day 2025', '2025-09-01', 8.00),
  ('Thanksgiving 2025', '2025-11-27', 8.00),
  ('Christmas 2025', '2025-12-25', 8.00),
  
  -- 2026 Holidays
  ('New Year''s Day 2026', '2026-01-01', 8.00),
  ('Independence Day 2026', '2026-07-04', 8.00),
  ('Labor Day 2026', '2026-09-07', 8.00),
  ('Thanksgiving 2026', '2026-11-26', 8.00),
  ('Christmas 2026', '2026-12-25', 8.00)
ON CONFLICT (holiday_date) DO NOTHING;

-- Add indexes
CREATE INDEX idx_company_holidays_date ON company_holidays(holiday_date) WHERE is_active = TRUE;

-- Add comments
COMMENT ON TABLE company_holidays IS 'Company-wide paid holidays';
COMMENT ON FUNCTION create_holiday_shifts() IS 'Automatically creates paid holiday shifts for all active employees. Should be run daily via cron job.';
