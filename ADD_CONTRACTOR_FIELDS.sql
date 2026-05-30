-- Add contractor support to employees table
ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS employment_type text DEFAULT 'employee',
  ADD COLUMN IF NOT EXISTS hourly_rate decimal(10,2) DEFAULT NULL;

-- Set existing employees to 'employee' type
UPDATE public.employees
SET employment_type = 'employee'
WHERE employment_type IS NULL;

-- Verify
SELECT user_id, first_name, last_name, employment_type, hourly_rate
FROM public.employees
ORDER BY first_name;
