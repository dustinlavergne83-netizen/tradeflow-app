-- Add password_must_change flag to employees table
ALTER TABLE employees
ADD COLUMN IF NOT EXISTS password_must_change BOOLEAN DEFAULT false;

-- Set existing employees to false (they've already set up)
UPDATE employees SET password_must_change = false WHERE password_must_change IS NULL;

-- Comment
COMMENT ON COLUMN employees.password_must_change IS 'Flag to force password change on first login for new employees';
