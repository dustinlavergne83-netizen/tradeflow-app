-- Add hourly rate, hire date, and vacation tracking fields to employees table
ALTER TABLE employees 
  ADD COLUMN IF NOT EXISTS hourly_rate DECIMAL(10,2) DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS hire_date DATE,
  ADD COLUMN IF NOT EXISTS vacation_hours_used DECIMAL(8,2) DEFAULT 0.00;

-- Add comments for clarity
COMMENT ON COLUMN employees.hourly_rate IS 'Employee hourly pay rate in dollars';
COMMENT ON COLUMN employees.hire_date IS 'Employee hire date - used to calculate vacation accrual (40 hrs per year after 1 year)';
COMMENT ON COLUMN employees.vacation_hours_used IS 'Total vacation hours used';
