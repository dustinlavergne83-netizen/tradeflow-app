-- Add admin column to employees table
ALTER TABLE employees ADD COLUMN IF NOT EXISTS admin BOOLEAN NOT NULL DEFAULT false;

-- Set YOUR account to admin (you'll need to update this with your actual employee ID or email)
-- Option 1: If you know your email
-- UPDATE employees SET admin = true WHERE email = 'dustin@dimlelectrical.com';

-- Option 2: If you know your employee ID
-- UPDATE employees SET admin = true WHERE id = 'your-uuid-here';

-- Option 3: Set the FIRST employee to admin (if that's you)
UPDATE employees SET admin = true WHERE id = (SELECT id FROM employees ORDER BY created_at LIMIT 1);

-- Verify
SELECT id, email, full_name, admin FROM employees WHERE admin = true;
