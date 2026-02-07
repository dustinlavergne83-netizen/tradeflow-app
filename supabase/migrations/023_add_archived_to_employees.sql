-- Add archived column to employees table
ALTER TABLE employees 
ADD COLUMN IF NOT EXISTS archived BOOLEAN DEFAULT FALSE;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_employees_archived ON employees(archived);

-- Update comment
COMMENT ON COLUMN employees.archived IS 'Soft delete - archived employees are hidden by default but can be restored';
