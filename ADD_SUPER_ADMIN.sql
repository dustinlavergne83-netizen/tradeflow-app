-- ============================================================
-- ADD SUPER ADMIN FLAG
-- ============================================================
-- Run this in Supabase SQL Editor
-- This adds is_super_admin to employees table so only YOU
-- (the platform owner) can see the super admin panel.
-- ============================================================

-- Add the flag
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'employees' AND column_name = 'is_super_admin'
  ) THEN
    ALTER TABLE employees ADD COLUMN is_super_admin BOOLEAN DEFAULT false;
  END IF;
END $$;

-- Set YOUR account as super admin (update email to match yours)
UPDATE employees 
SET is_super_admin = true 
WHERE email ILIKE '%dustin%' OR role = 'admin';

-- Verify
SELECT id, first_name, last_name, email, role, is_super_admin 
FROM employees 
WHERE is_super_admin = true;
