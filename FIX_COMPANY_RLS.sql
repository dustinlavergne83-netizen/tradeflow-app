-- ============================================================
-- FIX COMPANY RLS: True multi-tenant data isolation
-- Run each block SEPARATELY in Supabase SQL Editor
-- ============================================================
-- This uses a SECURITY DEFINER function to avoid the infinite
-- recursion problem that happens when RLS policies on the
-- employees table query the employees table themselves.
-- ============================================================


-- ══════════════════════════════════════════════════════════════
-- BLOCK 1: Create the SECURITY DEFINER helper function
-- Runs as postgres (bypasses RLS internally) to safely look up
-- the current user's company_id without recursion
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
  SELECT company_id INTO cid
  FROM employees
  WHERE user_id = auth.uid()
  ORDER BY created_at ASC
  LIMIT 1;
  RETURN cid;
END;
$$;


-- ══════════════════════════════════════════════════════════════
-- BLOCK 2: Drop ALL existing policies on employees
-- ══════════════════════════════════════════════════════════════
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT policyname FROM pg_policies
    WHERE tablename = 'employees' AND schemaname = 'public'
  LOOP
    EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(r.policyname) || ' ON employees';
  END LOOP;
END $$;


-- ══════════════════════════════════════════════════════════════
-- BLOCK 3: New employees policies — no recursion
-- Policy 1: users can always see their OWN record (self-lookup, no cross-table)
-- Policy 2: users can see all employees in their company (via SECURITY DEFINER)
-- ══════════════════════════════════════════════════════════════
CREATE POLICY "employees_self"
  ON employees FOR ALL
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "employees_same_company"
  ON employees FOR ALL
  TO authenticated
  USING (company_id = get_my_company_id());


-- ══════════════════════════════════════════════════════════════
-- BLOCK 4: Fix shifts isolation
-- ══════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "auth_only" ON shifts;
DROP POLICY IF EXISTS "shifts_company_isolation" ON shifts;

CREATE POLICY "shifts_company_isolation"
  ON shifts FOR ALL
  TO authenticated
  USING (company_id = get_my_company_id());


-- ══════════════════════════════════════════════════════════════
-- BLOCK 5: Fix shift_segments isolation
-- ══════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "auth_only" ON shift_segments;
DROP POLICY IF EXISTS "shift_segments_company_isolation" ON shift_segments;

CREATE POLICY "shift_segments_company_isolation"
  ON shift_segments FOR ALL
  TO authenticated
  USING (company_id = get_my_company_id());


-- ══════════════════════════════════════════════════════════════
-- BLOCK 6: Fix timeclock_projects isolation
-- ══════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "auth_only" ON timeclock_projects;
DROP POLICY IF EXISTS "projects_company_isolation" ON timeclock_projects;

CREATE POLICY "projects_company_isolation"
  ON timeclock_projects FOR ALL
  TO authenticated
  USING (company_id = get_my_company_id());


-- ══════════════════════════════════════════════════════════════
-- BLOCK 7: Fix companies table isolation
-- Users can only read their own company record
-- ══════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "Users can read own company" ON companies;

CREATE POLICY "companies_own_only"
  ON companies FOR SELECT
  TO authenticated
  USING (id = get_my_company_id());


-- ══════════════════════════════════════════════════════════════
-- BLOCK 8: Verify — check all policies are in place
-- ══════════════════════════════════════════════════════════════
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE tablename IN ('employees', 'shifts', 'shift_segments', 'timeclock_projects', 'companies')
ORDER BY tablename, policyname;

-- Sanity check: you should only see YOUR company's employees
SELECT id, first_name, last_name, company_id FROM employees ORDER BY first_name;
