-- ============================================================
-- FIX: Portal shows nothing (employees / timesheets / jobs all blank)
-- 
-- Root cause: company_id is NULL on some records after RLS was tightened.
-- Fix: backfill company_id on all DML records + rebuild get_my_company_id()
-- ============================================================

-- Step 1: Re-create get_my_company_id() as SECURITY DEFINER (bypasses RLS)
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

-- Step 2: Find DML company and backfill ALL tables with NULL company_id
DO $$
DECLARE
  dml_id UUID;
BEGIN
  SELECT id INTO dml_id FROM companies WHERE name ILIKE '%DML%' LIMIT 1;
  IF dml_id IS NULL THEN RAISE EXCEPTION 'DML company not found'; END IF;

  UPDATE employees       SET company_id = dml_id WHERE company_id IS NULL;
  UPDATE projects        SET company_id = dml_id WHERE company_id IS NULL;
  UPDATE shifts          SET company_id = dml_id WHERE company_id IS NULL;
  UPDATE shift_segments  SET company_id = dml_id WHERE company_id IS NULL;
  UPDATE invoices        SET company_id = dml_id WHERE company_id IS NULL;

  RAISE NOTICE 'Backfill done. DML company_id = %', dml_id;
END $$;

-- Step 3: Drop conflicting / duplicate policies
DROP POLICY IF EXISTS "Company members can read all employees in their company" ON employees;
DROP POLICY IF EXISTS "Public can read companies" ON employees;

-- Step 4: Verify data is accessible
SELECT 'employees' AS tbl, count(*) FROM employees;
SELECT 'shifts'    AS tbl, count(*) FROM shifts    WHERE company_id IS NOT NULL;
SELECT 'projects'  AS tbl, count(*) FROM projects  WHERE company_id IS NOT NULL;
