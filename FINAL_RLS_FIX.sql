-- ============================================================
-- FINAL RLS FIX — Run in Supabase SQL Editor
-- Run each BLOCK separately, in order
-- ============================================================
-- Fixes:
--   1. Delete dmltester95 + tyweldon8898 (company_id = NULL, broken)
--   2. Wipe 15 duplicate shifts policies → 4 clean ones
--   3. Drop conflicting "Public can read companies" policy
--   4. Leave employees policies as-is (they're correct)
-- ============================================================


-- ════════════════════════════════════════════════════════════
-- BLOCK 1: Delete broken employee rows (company_id = NULL)
-- These accounts can never load a company context — app breaks
-- ════════════════════════════════════════════════════════════

-- Preview first (run this to confirm):
SELECT id, first_name, email, user_id, company_id
FROM employees
WHERE company_id IS NULL;

-- Then delete the employee rows:
DELETE FROM employees WHERE company_id IS NULL;

-- Delete their auth accounts too so they can't log in
-- (requires service-role or postgres role — run in SQL editor)
DELETE FROM auth.users
WHERE id IN (
  'cd1974c1-f4c0-428a-9bd9-048e71b4c334',  -- dmltester95@gmail.com
  'b8b43476-f36b-4587-b235-04953b7b7cb5'   -- tyweldon8898@gmail.com
);


-- ════════════════════════════════════════════════════════════
-- BLOCK 2: Wipe ALL shifts policies (15 conflicting ones)
-- ════════════════════════════════════════════════════════════

DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT policyname FROM pg_policies
    WHERE tablename = 'shifts' AND schemaname = 'public'
  LOOP
    EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(r.policyname) || ' ON shifts';
  END LOOP;
END $$;

-- Confirm all gone:
SELECT policyname FROM pg_policies WHERE tablename = 'shifts';


-- ════════════════════════════════════════════════════════════
-- BLOCK 3: Create 4 clean shifts policies
-- Company-isolated: you can only see/touch your company's shifts
-- ════════════════════════════════════════════════════════════

-- SELECT: see your company's shifts (includes admin viewing all employees)
CREATE POLICY "shifts_select"
  ON shifts FOR SELECT
  TO authenticated
  USING (company_id = get_my_company_id());

-- INSERT: can only insert shifts for your company
CREATE POLICY "shifts_insert"
  ON shifts FOR INSERT
  TO authenticated
  WITH CHECK (company_id = get_my_company_id());

-- UPDATE: can only update your company's shifts
CREATE POLICY "shifts_update"
  ON shifts FOR UPDATE
  TO authenticated
  USING (company_id = get_my_company_id())
  WITH CHECK (company_id = get_my_company_id());

-- DELETE: can only delete your company's shifts
CREATE POLICY "shifts_delete"
  ON shifts FOR DELETE
  TO authenticated
  USING (company_id = get_my_company_id());


-- ════════════════════════════════════════════════════════════
-- BLOCK 4: Wipe all shift_segments policies → 2 clean ones
-- ════════════════════════════════════════════════════════════

DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT policyname FROM pg_policies
    WHERE tablename = 'shift_segments' AND schemaname = 'public'
  LOOP
    EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(r.policyname) || ' ON shift_segments';
  END LOOP;
END $$;

-- Recreate clean policy (if shift_segments table exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'shift_segments'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "shift_segments_company"
        ON shift_segments FOR ALL
        TO authenticated
        USING (company_id = get_my_company_id())
        WITH CHECK (company_id = get_my_company_id())
    $policy$;
  END IF;
END $$;


-- ════════════════════════════════════════════════════════════
-- BLOCK 5: Fix companies table — drop the "true" public policy
-- ════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "Public can read companies" ON companies;

-- Confirm only companies_own_only remains:
SELECT policyname, cmd, qual FROM pg_policies WHERE tablename = 'companies';


-- ════════════════════════════════════════════════════════════
-- BLOCK 6: Final verification — all policies should be clean
-- ════════════════════════════════════════════════════════════

SELECT tablename, policyname, cmd
FROM pg_policies
WHERE tablename IN ('employees', 'shifts', 'shift_segments', 'timeclock_projects', 'companies')
ORDER BY tablename, policyname;

-- Expected result:
-- companies      → companies_own_only (SELECT)
-- employees      → employees_same_company (ALL), employees_self (ALL)
-- shift_segments → shift_segments_company (ALL)
-- shifts         → shifts_delete (DELETE), shifts_insert (INSERT),
--                  shifts_select (SELECT), shifts_update (UPDATE)
-- timeclock_projects → projects_company_isolation (ALL)


-- ════════════════════════════════════════════════════════════
-- BLOCK 7: Quick sanity test — does your own company load?
-- Run this as yourself to verify get_my_company_id() works:
-- ════════════════════════════════════════════════════════════

SELECT get_my_company_id() AS my_company_id;

SELECT id, first_name, last_name, role, company_id
FROM employees
WHERE company_id = get_my_company_id()
ORDER BY first_name;
