-- Fix: Allow authenticated users to read all employees in their company
-- This is needed so the portal dashboard can show employee names in timesheets

-- Allow any authenticated user to read employees in their same company
CREATE POLICY "Company members can read all employees in their company"
  ON employees
  FOR SELECT
  TO authenticated
  USING (
    company_id = (
      SELECT company_id FROM employees WHERE user_id = auth.uid() LIMIT 1
    )
  );

-- If policy already exists:
-- DROP POLICY IF EXISTS "Company members can read all employees in their company" ON employees;
-- Then re-run the CREATE POLICY above.

-- Verify: should return all DML employees
SELECT id, first_name, last_name, role, is_active FROM employees ORDER BY first_name;
