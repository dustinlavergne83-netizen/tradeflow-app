-- ============================================================
-- TradeFlow: Row Level Security — Company Data Isolation
-- Run this in Supabase SQL Editor
-- ============================================================
-- PROBLEM: Direct subqueries on the employees table from within
--   an employees RLS policy cause a circular reference error.
-- SOLUTION: A SECURITY DEFINER function bypasses RLS when it runs,
--   so it can safely look up the current user's company_id without
--   triggering the policy on employees again.
-- ============================================================

-- ── STEP 1: Helper function ───────────────────────────────────────────────
-- Returns the company_id for the currently authenticated user.
-- SECURITY DEFINER = runs as the function owner (bypasses RLS), safe.
CREATE OR REPLACE FUNCTION get_my_company_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT company_id FROM employees WHERE user_id = auth.uid() LIMIT 1
$$;

-- ── STEP 2: COMPANIES table ───────────────────────────────────────────────
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;

-- Public read: portal login/clock pages load company by slug BEFORE login
CREATE POLICY "companies_public_read"
ON companies FOR SELECT
USING (true);

-- Auth insert: any authenticated user can create a company (during signup)
CREATE POLICY "companies_auth_insert"
ON companies FOR INSERT
TO authenticated
WITH CHECK (true);

-- Auth update: users can only update their own company
CREATE POLICY "companies_auth_update"
ON companies FOR UPDATE
TO authenticated
USING (id = get_my_company_id())
WITH CHECK (id = get_my_company_id());

-- ── STEP 3: EMPLOYEES table ───────────────────────────────────────────────
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;

-- Anon read: invite activation looks up pending invite BEFORE auth
-- Only exposes records that have an invite_token and no user yet
CREATE POLICY "employees_anon_read_invites"
ON employees FOR SELECT
TO anon
USING (invite_token IS NOT NULL AND user_id IS NULL);

-- Auth read: see all employees in your own company
CREATE POLICY "employees_auth_read"
ON employees FOR SELECT
TO authenticated
USING (company_id = get_my_company_id());

-- Auth insert: allowed for signup (admin creates own record) and invite flow
CREATE POLICY "employees_auth_insert"
ON employees FOR INSERT
TO authenticated
WITH CHECK (true);

-- Auth update:
--   (a) admins can update any employee in their company
--   (b) employees can claim their own pending invite record (email must match)
CREATE POLICY "employees_auth_update"
ON employees FOR UPDATE
TO authenticated
USING (
  company_id = get_my_company_id()
  OR (
    user_id IS NULL
    AND invite_token IS NOT NULL
    AND email = (auth.jwt() ->> 'email')
  )
)
WITH CHECK (true);

-- ── STEP 4: SHIFTS table ─────────────────────────────────────────────────
ALTER TABLE shifts ENABLE ROW LEVEL SECURITY;

-- Users can only see shifts for their company
CREATE POLICY "shifts_auth_read"
ON shifts FOR SELECT
TO authenticated
USING (company_id = get_my_company_id());

-- Employees can clock in (insert) for their own company
CREATE POLICY "shifts_auth_insert"
ON shifts FOR INSERT
TO authenticated
WITH CHECK (company_id = get_my_company_id());

-- Employees/admins can update shifts (clock out, admin edits)
CREATE POLICY "shifts_auth_update"
ON shifts FOR UPDATE
TO authenticated
USING (company_id = get_my_company_id())
WITH CHECK (company_id = get_my_company_id());

-- Admins can delete shifts in their company
CREATE POLICY "shifts_auth_delete"
ON shifts FOR DELETE
TO authenticated
USING (company_id = get_my_company_id());

-- ── STEP 5: PROJECTS table ────────────────────────────────────────────────
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

-- Users can only see projects for their company
CREATE POLICY "projects_auth_read"
ON projects FOR SELECT
TO authenticated
USING (company_id = get_my_company_id());

-- Admins can insert new jobs/projects
CREATE POLICY "projects_auth_insert"
ON projects FOR INSERT
TO authenticated
WITH CHECK (company_id = get_my_company_id());

-- Admins can update jobs
CREATE POLICY "projects_auth_update"
ON projects FOR UPDATE
TO authenticated
USING (company_id = get_my_company_id())
WITH CHECK (company_id = get_my_company_id());

-- Admins can delete jobs
CREATE POLICY "projects_auth_delete"
ON projects FOR DELETE
TO authenticated
USING (company_id = get_my_company_id());

-- ── STEP 6: SHIFT_SEGMENTS table ─────────────────────────────────────────
ALTER TABLE shift_segments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "shift_segments_auth_read"
ON shift_segments FOR SELECT
TO authenticated
USING (company_id = get_my_company_id());

CREATE POLICY "shift_segments_auth_insert"
ON shift_segments FOR INSERT
TO authenticated
WITH CHECK (company_id = get_my_company_id());

CREATE POLICY "shift_segments_auth_update"
ON shift_segments FOR UPDATE
TO authenticated
USING (company_id = get_my_company_id())
WITH CHECK (company_id = get_my_company_id());

CREATE POLICY "shift_segments_auth_delete"
ON shift_segments FOR DELETE
TO authenticated
USING (company_id = get_my_company_id());

-- ── VERIFY ────────────────────────────────────────────────────────────────
SELECT tablename, policyname, cmd, qual
FROM pg_policies
WHERE tablename IN ('companies', 'employees', 'shifts', 'projects', 'shift_segments')
ORDER BY tablename, cmd;
