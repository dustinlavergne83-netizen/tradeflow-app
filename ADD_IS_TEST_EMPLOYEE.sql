-- Add is_test column to employees table
-- Run this in your Supabase SQL editor

ALTER TABLE employees
ADD COLUMN IF NOT EXISTS is_test boolean NOT NULL DEFAULT false;

-- Optional: mark existing test accounts manually after running
-- UPDATE employees SET is_test = true WHERE first_name = 'Test' OR email LIKE '%test%';
