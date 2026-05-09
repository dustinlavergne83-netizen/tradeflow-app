-- ============================================================
-- ADD company_id TO MISSING TABLES + BACKFILL DML DATA
-- Run this in Supabase SQL Editor ONCE.
-- ============================================================

DO $$
DECLARE
  dml_company_id UUID;
BEGIN
  -- Find DML company
  SELECT id INTO dml_company_id
  FROM companies
  WHERE name ILIKE '%DML%' OR name ILIKE '%Lavergne%'
  LIMIT 1;

  IF dml_company_id IS NULL THEN
    RAISE EXCEPTION 'Could not find DML company. Check your companies table.';
  END IF;

  RAISE NOTICE 'DML company_id = %', dml_company_id;

  -- ── Add company_id column to tables that are missing it ──────────────────

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'invoices' AND column_name = 'company_id') THEN
    ALTER TABLE invoices ADD COLUMN company_id UUID REFERENCES companies(id);
    RAISE NOTICE 'Added company_id to invoices';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shifts' AND column_name = 'company_id') THEN
    ALTER TABLE shifts ADD COLUMN company_id UUID REFERENCES companies(id);
    RAISE NOTICE 'Added company_id to shifts';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shift_segments' AND column_name = 'company_id') THEN
    ALTER TABLE shift_segments ADD COLUMN company_id UUID REFERENCES companies(id);
    RAISE NOTICE 'Added company_id to shift_segments';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'time_entries' AND column_name = 'company_id') THEN
    ALTER TABLE time_entries ADD COLUMN company_id UUID REFERENCES companies(id);
    RAISE NOTICE 'Added company_id to time_entries';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'estimates' AND column_name = 'company_id') THEN
    ALTER TABLE estimates ADD COLUMN company_id UUID REFERENCES companies(id);
    RAISE NOTICE 'Added company_id to estimates';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vendors' AND column_name = 'company_id') THEN
    ALTER TABLE vendors ADD COLUMN company_id UUID REFERENCES companies(id);
    RAISE NOTICE 'Added company_id to vendors';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'customers' AND column_name = 'company_id') THEN
    ALTER TABLE customers ADD COLUMN company_id UUID REFERENCES companies(id);
    RAISE NOTICE 'Added company_id to customers';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'projects' AND column_name = 'company_id') THEN
    ALTER TABLE projects ADD COLUMN company_id UUID REFERENCES companies(id);
    RAISE NOTICE 'Added company_id to projects';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'employees' AND column_name = 'company_id') THEN
    ALTER TABLE employees ADD COLUMN company_id UUID REFERENCES companies(id);
    RAISE NOTICE 'Added company_id to employees';
  END IF;

  -- ── Backfill all NULL company_id rows with DML's ID ──────────────────────

  UPDATE projects        SET company_id = dml_company_id WHERE company_id IS NULL;
  UPDATE invoices        SET company_id = dml_company_id WHERE company_id IS NULL;
  UPDATE shifts          SET company_id = dml_company_id WHERE company_id IS NULL;
  UPDATE shift_segments  SET company_id = dml_company_id WHERE company_id IS NULL;
  UPDATE employees       SET company_id = dml_company_id WHERE company_id IS NULL;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'time_entries') THEN
    UPDATE time_entries  SET company_id = dml_company_id WHERE company_id IS NULL;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'estimates') THEN
    UPDATE estimates     SET company_id = dml_company_id WHERE company_id IS NULL;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'vendors') THEN
    UPDATE vendors       SET company_id = dml_company_id WHERE company_id IS NULL;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'customers') THEN
    UPDATE customers     SET company_id = dml_company_id WHERE company_id IS NULL;
  END IF;

  RAISE NOTICE 'Backfill complete!';
END $$;

-- ── Tighten RLS: strict company isolation, no NULL loophole ──────────────

DROP POLICY IF EXISTS "company_isolation_projects" ON projects;
CREATE POLICY "company_isolation_projects" ON projects
  FOR ALL USING (company_id = get_my_company_id());

DROP POLICY IF EXISTS "company_isolation_invoices" ON invoices;
CREATE POLICY "company_isolation_invoices" ON invoices
  FOR ALL USING (company_id = get_my_company_id());

DROP POLICY IF EXISTS "company_isolation_shifts" ON shifts;
CREATE POLICY "company_isolation_shifts" ON shifts
  FOR ALL USING (company_id = get_my_company_id());

DROP POLICY IF EXISTS "company_isolation_shift_segments" ON shift_segments;
CREATE POLICY "company_isolation_shift_segments" ON shift_segments
  FOR ALL USING (company_id = get_my_company_id());

DROP POLICY IF EXISTS "company_isolation_employees" ON employees;
CREATE POLICY "company_isolation_employees" ON employees
  FOR ALL USING (company_id = get_my_company_id());

SELECT 'Done! DML data is isolated. New companies start with a clean slate.' AS result;
