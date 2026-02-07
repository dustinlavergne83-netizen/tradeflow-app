-- First, check the current status of your employee record
SELECT email, password_must_change, first_name, last_name, policy_acknowledged 
FROM employees 
WHERE email LIKE '%dustinlavergne%' OR email LIKE '%dustin%';

-- Set password_must_change to true for your account
UPDATE employees 
SET password_must_change = true 
WHERE email LIKE '%dustinlavergne%' OR email LIKE '%dustin%';

-- Verify it was set
SELECT email, password_must_change, first_name, last_name 
FROM employees 
WHERE email LIKE '%dustinlavergne%' OR email LIKE '%dustin%';

-- If you see NULL values, the column might not exist yet. 
-- Make sure you ran the migration: npx supabase db push
