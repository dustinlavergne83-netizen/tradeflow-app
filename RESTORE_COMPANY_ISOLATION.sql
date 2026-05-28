-- ============================================================
-- RESTORE COMPANY ISOLATION on employees table
-- Run each block separately in Supabase SQL Editor
-- ============================================================

-- ══════════════════════════════════════════════════════════════
-- BLOCK 1: Ensure get_my_company_id() function exists and is 
--          properly SECURITY DEFINER (bypasses RLS internally)
-- ══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION get_my_company_id()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cid UUID;
BEGIN
  -- Runs as postgres (superuser) so it bypasses RLS on employees
  SELECT company_id INTO cid
  FROM employees
  WHERE user_id = auth.uid()
  LIMIT 1;
  -- For admins whose employee.company_id = their own uid, this still works
  RETURN COALESCE(cid, auth.uid());
END;
$$;


-- ══════════════════════════════════════════════════════════════
-- BLOCK 2: Drop the simple auth_only policy
-- ══════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "auth_only" ON employees;


-- ══════════════════════════════════════════════════════════════
-- BLOCK 3: Add company-isolated policies
-- Policy 1: users can always see their OWN record (safe, no recursion)
-- Policy 2: users can see all employees in their company (via SECURITY DEFINER)
-- ══════════════════════════════════════════════════════════════
CREATE POLICY "employees_self_access"
  ON employees FOR ALL
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "employees_company_access"
  ON employees FOR ALL
  TO authenticated
  USING (company_id = get_my_company_id());


-- ══════════════════════════════════════════════════════════════
-- BLOCK 4: Verify — should show 2 policies on employees
-- ══════════════════════════════════════════════════════════════
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE tablename = 'employees'
ORDER BY policyname;

-- Confirm employees still load (if this returns rows, it worked!)
SELECT id, first_name, last_name, role FROM employees ORDER BY first_name;
