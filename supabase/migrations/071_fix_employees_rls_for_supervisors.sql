-- Fix employees table RLS policies to allow supervisors and admins to view all employees
-- This is needed for the crew clock functionality

-- First, create a security definer function to check if current user is supervisor or admin
-- This bypasses RLS to avoid infinite recursion
CREATE OR REPLACE FUNCTION is_supervisor_or_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_role TEXT;
BEGIN
  SELECT role INTO user_role
  FROM employees
  WHERE user_id = auth.uid()
  LIMIT 1;
  
  RETURN user_role IN ('supervisor', 'admin');
END;
$$;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view all employees" ON employees;
DROP POLICY IF EXISTS "Employees can view their own record" ON employees;
DROP POLICY IF EXISTS "Supervisors and admins can view all employees" ON employees;
DROP POLICY IF EXISTS "Users can view own employee record" ON employees;
DROP POLICY IF EXISTS "Supervisors and admins can update employees" ON employees;

-- Create new policy: Allow users to view their own employee record
CREATE POLICY "Users can view own employee record"
ON employees
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Create new policy: Allow supervisors and admins to view all employees
-- Uses security definer function to avoid infinite recursion
CREATE POLICY "Supervisors and admins can view all employees"
ON employees
FOR SELECT
TO authenticated
USING (is_supervisor_or_admin());

-- Allow supervisors and admins to update employee records (for crew clock)
CREATE POLICY "Supervisors and admins can update employees"
ON employees
FOR UPDATE
TO authenticated
USING (is_supervisor_or_admin());

COMMENT ON FUNCTION is_supervisor_or_admin IS 'Security definer function to check if current user is supervisor or admin, bypasses RLS to avoid recursion';
COMMENT ON POLICY "Supervisors and admins can view all employees" ON employees 
IS 'Allow supervisors and admins to view all employee records for crew clock and management features';
