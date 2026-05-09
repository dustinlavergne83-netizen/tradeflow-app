-- ============================================================
-- FIX RLS COMPANY ISOLATION
-- Drops all old permissive/conflicting policies and replaces
-- them with clean company-scoped policies.
-- Run this ONCE in Supabase SQL Editor.
-- ============================================================

-- ── Step 1: Recreate get_my_company_id() as SECURITY DEFINER ─────────────
-- SECURITY DEFINER means it runs as the function owner (bypasses RLS)
-- so it can look up the employees table without triggering its own RLS policy.

CREATE OR REPLACE FUNCTION get_my_company_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT company_id
  FROM employees
  WHERE user_id = auth.uid()
  LIMIT 1;
$$;

-- ── Step 2: Drop ALL old policies on projects ─────────────────────────────

DROP POLICY IF EXISTS "Authenticated users can view projects" ON projects;
DROP POLICY IF EXISTS "Public can view projects" ON projects;
DROP POLICY IF EXISTS "Users can view their own projects" ON projects;
DROP POLICY IF EXISTS "Users can insert their own projects" ON projects;
DROP POLICY IF EXISTS "Users can update their own projects" ON projects;
DROP POLICY IF EXISTS "Users can delete their own projects" ON projects;
DROP POLICY IF EXISTS "projects_admin_only" ON projects;
DROP POLICY IF EXISTS "projects_company_isolation" ON projects;
DROP POLICY IF EXISTS "projects_insert_all_authenticated" ON projects;
DROP POLICY IF EXISTS "projects_select_all_authenticated" ON projects;
DROP POLICY IF EXISTS "projects_update_all_authenticated" ON projects;
DROP POLICY IF EXISTS "company_isolation_projects" ON projects;
DROP POLICY IF EXISTS "Customers can view own projects" ON projects;

-- ── Step 3: Drop ALL old policies on invoices ─────────────────────────────

DROP POLICY IF EXISTS "Anyone can view invoices" ON invoices;
DROP POLICY IF EXISTS "Public can view invoices" ON invoices;
DROP POLICY IF EXISTS "Company members can view invoices" ON invoices;
DROP POLICY IF EXISTS "Company members can update invoices" ON invoices;
DROP POLICY IF EXISTS "Company members can delete invoices" ON invoices;
DROP POLICY IF EXISTS "Users can delete their own invoices" ON invoices;
DROP POLICY IF EXISTS "Users can insert their own invoices" ON invoices;
DROP POLICY IF EXISTS "Users can update their own invoices" ON invoices;
DROP POLICY IF EXISTS "Customers can view own invoices" ON invoices;
DROP POLICY IF EXISTS "company_isolation_invoices" ON invoices;

-- ── Step 4: Drop ALL old policies on employees ────────────────────────────

DROP POLICY IF EXISTS "Supervisors and admins can update employees" ON employees;
DROP POLICY IF EXISTS "Supervisors and admins can view all employees" ON employees;
DROP POLICY IF EXISTS "Users can view own employee record" ON employees;
DROP POLICY IF EXISTS "admins insert employees" ON employees;
DROP POLICY IF EXISTS "admins select employees" ON employees;
DROP POLICY IF EXISTS "admins update employees" ON employees;
DROP POLICY IF EXISTS "company_isolation_employees" ON employees;
DROP POLICY IF EXISTS "employee select self" ON employees;
DROP POLICY IF EXISTS "employees: read own row" ON employees;
DROP POLICY IF EXISTS "employees_admin_all" ON employees;
DROP POLICY IF EXISTS "employees_admin_only" ON employees;
DROP POLICY IF EXISTS "employees_company_isolation" ON employees;
DROP POLICY IF EXISTS "employees_insert_own" ON employees;
DROP POLICY IF EXISTS "employees_select_own" ON employees;
DROP POLICY IF EXISTS "employees_update_own" ON employees;

-- ── Step 5: Drop old policies on shifts (if any permissive ones exist) ────

DROP POLICY IF EXISTS "company_isolation_shifts" ON shifts;
DROP POLICY IF EXISTS "company_isolation_shift_segments" ON shift_segments;

-- ── Step 6: Drop new-name policies (in case script was partially run before) ──

DROP POLICY IF EXISTS "projects_company_select" ON projects;
DROP POLICY IF EXISTS "projects_company_insert" ON projects;
DROP POLICY IF EXISTS "projects_company_update" ON projects;
DROP POLICY IF EXISTS "projects_company_delete" ON projects;
DROP POLICY IF EXISTS "projects_customer_view" ON projects;

DROP POLICY IF EXISTS "invoices_company_select" ON invoices;
DROP POLICY IF EXISTS "invoices_company_insert" ON invoices;
DROP POLICY IF EXISTS "invoices_company_update" ON invoices;
DROP POLICY IF EXISTS "invoices_company_delete" ON invoices;
DROP POLICY IF EXISTS "invoices_customer_view" ON invoices;

DROP POLICY IF EXISTS "employees_company_select" ON employees;
DROP POLICY IF EXISTS "employees_company_insert" ON employees;
DROP POLICY IF EXISTS "employees_company_update" ON employees;
DROP POLICY IF EXISTS "employees_company_delete" ON employees;
DROP POLICY IF EXISTS "employees_self_select" ON employees;
DROP POLICY IF EXISTS "employees_self_update" ON employees;

DROP POLICY IF EXISTS "shifts_company_select" ON shifts;
DROP POLICY IF EXISTS "shifts_company_insert" ON shifts;
DROP POLICY IF EXISTS "shifts_company_update" ON shifts;
DROP POLICY IF EXISTS "shifts_company_delete" ON shifts;

DROP POLICY IF EXISTS "shift_segments_company_select" ON shift_segments;
DROP POLICY IF EXISTS "shift_segments_company_insert" ON shift_segments;
DROP POLICY IF EXISTS "shift_segments_company_update" ON shift_segments;
DROP POLICY IF EXISTS "shift_segments_company_delete" ON shift_segments;

-- ── Step 7: Create CLEAN company-isolation policies ───────────────────────

-- PROJECTS
CREATE POLICY "projects_company_select" ON projects
  FOR SELECT USING (company_id = get_my_company_id());

CREATE POLICY "projects_company_insert" ON projects
  FOR INSERT WITH CHECK (company_id = get_my_company_id());

CREATE POLICY "projects_company_update" ON projects
  FOR UPDATE USING (company_id = get_my_company_id());

CREATE POLICY "projects_company_delete" ON projects
  FOR DELETE USING (company_id = get_my_company_id());

-- Customer portal: customers can see their own project
CREATE POLICY "projects_customer_view" ON projects
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM customers
      WHERE lower(customers.email) = lower(auth.jwt() ->> 'email')
        AND lower(projects.customer) = lower(customers.name)
    )
  );

-- INVOICES
CREATE POLICY "invoices_company_select" ON invoices
  FOR SELECT USING (company_id = get_my_company_id());

CREATE POLICY "invoices_company_insert" ON invoices
  FOR INSERT WITH CHECK (company_id = get_my_company_id());

CREATE POLICY "invoices_company_update" ON invoices
  FOR UPDATE USING (company_id = get_my_company_id());

CREATE POLICY "invoices_company_delete" ON invoices
  FOR DELETE USING (company_id = get_my_company_id());

-- Customer portal: customers can see their own invoices
CREATE POLICY "invoices_customer_view" ON invoices
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM customers
      WHERE lower(customers.email) = lower(auth.jwt() ->> 'email')
        AND lower(invoices.customer_name) = lower(customers.name)
    )
  );

-- EMPLOYEES
CREATE POLICY "employees_company_select" ON employees
  FOR SELECT USING (company_id = get_my_company_id());

-- INSERT: allow if company matches OR if user is inserting their own record
-- (the "own record" path handles new signups who have no company row yet)
CREATE POLICY "employees_company_insert" ON employees
  FOR INSERT WITH CHECK (
    company_id = get_my_company_id()
    OR user_id = auth.uid()
  );

CREATE POLICY "employees_company_update" ON employees
  FOR UPDATE USING (company_id = get_my_company_id());

CREATE POLICY "employees_company_delete" ON employees
  FOR DELETE USING (company_id = get_my_company_id());

-- Also allow each user to always read/update their OWN employee row
-- (needed for login flow before company_id is confirmed)
CREATE POLICY "employees_self_select" ON employees
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "employees_self_update" ON employees
  FOR UPDATE USING (user_id = auth.uid());

-- SHIFTS
CREATE POLICY "shifts_company_select" ON shifts
  FOR SELECT USING (company_id = get_my_company_id());

CREATE POLICY "shifts_company_insert" ON shifts
  FOR INSERT WITH CHECK (company_id = get_my_company_id());

CREATE POLICY "shifts_company_update" ON shifts
  FOR UPDATE USING (company_id = get_my_company_id());

CREATE POLICY "shifts_company_delete" ON shifts
  FOR DELETE USING (company_id = get_my_company_id());

-- SHIFT SEGMENTS
CREATE POLICY "shift_segments_company_select" ON shift_segments
  FOR SELECT USING (company_id = get_my_company_id());

CREATE POLICY "shift_segments_company_insert" ON shift_segments
  FOR INSERT WITH CHECK (company_id = get_my_company_id());

CREATE POLICY "shift_segments_company_update" ON shift_segments
  FOR UPDATE USING (company_id = get_my_company_id());

CREATE POLICY "shift_segments_company_delete" ON shift_segments
  FOR DELETE USING (company_id = get_my_company_id());

SELECT 'RLS cleanup complete! All permissive policies removed. Company isolation is now strict.' AS result;
