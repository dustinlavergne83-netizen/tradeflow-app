-- ============================================================
-- EMERGENCY FIX: Multi-Company RLS Recursive Loop
-- ============================================================
-- The employees_company_isolation policy was self-referential
-- (querying employees to check access to employees = infinite loop)
-- This caused ALL data to disappear.
-- 
-- Run ALL of this in Supabase SQL Editor immediately.
-- ============================================================

-- ── STEP 1: Fix the recursive employees policy ─────────────────────────────
-- Old policy was: SELECT company_id FROM employees WHERE user_id = auth.uid()
-- That queries employees to check employees = recursive loop!
-- New policy: users can see their own row + rows from same company
-- using the security-definer helper function (no recursion).

DROP POLICY IF EXISTS "employees_company_isolation" ON employees;

-- Simple non-recursive policy: you can read employees in your company
-- get_my_company_id() is SECURITY DEFINER so it bypasses RLS internally
CREATE POLICY "employees_company_isolation" ON employees
  FOR ALL USING (
    company_id = get_my_company_id()
    OR user_id = auth.uid()  -- always allow seeing your own row
  );

-- ── STEP 2: Fix all other company isolation policies to use the function ────
-- (These were fine, but let's standardize to avoid any issues)

DROP POLICY IF EXISTS "shifts_company_isolation" ON shifts;
CREATE POLICY "shifts_company_isolation" ON shifts
  FOR ALL USING (
    company_id = get_my_company_id()
    OR company_id IS NULL  -- backward compat for any old data
  );

DROP POLICY IF EXISTS "shift_segments_company_isolation" ON shift_segments;
CREATE POLICY "shift_segments_company_isolation" ON shift_segments
  FOR ALL USING (
    company_id = get_my_company_id()
    OR company_id IS NULL
  );

DROP POLICY IF EXISTS "projects_company_isolation" ON projects;
CREATE POLICY "projects_company_isolation" ON projects
  FOR ALL USING (
    company_id = get_my_company_id()
    OR company_id IS NULL
  );

DROP POLICY IF EXISTS "time_entries_company_isolation" ON time_entries;
CREATE POLICY "time_entries_company_isolation" ON time_entries
  FOR ALL USING (
    company_id = get_my_company_id()
    OR company_id IS NULL
  );

DROP POLICY IF EXISTS "location_history_company_isolation" ON location_history;
CREATE POLICY "location_history_company_isolation" ON location_history
  FOR ALL USING (
    company_id = get_my_company_id()
    OR company_id IS NULL
  );

-- ── STEP 3: Make sure get_my_company_id() function exists and is correct ────
CREATE OR REPLACE FUNCTION get_my_company_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT company_id FROM employees WHERE user_id = auth.uid() LIMIT 1;
$$;

-- ── STEP 4: Verify your data is back ────────────────────────────────────────
-- Run these one at a time to confirm:
-- SELECT COUNT(*) FROM projects;
-- SELECT COUNT(*) FROM employees;
-- SELECT COUNT(*) FROM shifts;
-- SELECT id, name, company_id FROM projects LIMIT 5;
