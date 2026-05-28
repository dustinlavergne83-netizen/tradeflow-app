-- ============================================================
-- TradeFlow Timeclock - Table Creation + RLS Setup
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. Create timeclock_projects table if it doesn't exist
CREATE TABLE IF NOT EXISTS timeclock_projects (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  uuid NOT NULL,
  name        text NOT NULL,
  description text,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- 2. Enable RLS on all 4 timeclock tables
ALTER TABLE employees          ENABLE ROW LEVEL SECURITY;
ALTER TABLE shifts              ENABLE ROW LEVEL SECURITY;
ALTER TABLE timeclock_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS shift_segments ENABLE ROW LEVEL SECURITY;

-- 3. Drop any old policies (safe even if they don't exist)
DROP POLICY IF EXISTS "auth_only" ON employees;
DROP POLICY IF EXISTS "auth_only" ON shifts;
DROP POLICY IF EXISTS "auth_only" ON timeclock_projects;
DROP POLICY IF EXISTS "auth_only" ON shift_segments;

-- 4. Create simple "must be logged in" policies
CREATE POLICY "auth_only" ON employees
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "auth_only" ON shifts
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "auth_only" ON timeclock_projects
  FOR ALL USING (auth.role() = 'authenticated');

-- shift_segments may or may not exist — only run if it does
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'shift_segments'
  ) THEN
    CREATE POLICY "auth_only" ON shift_segments
      FOR ALL USING (auth.role() = 'authenticated');
  END IF;
END $$;

-- ============================================================
-- Done! All 4 tables now require a valid login session.
-- Application-level company_id filtering handles data isolation.
-- ============================================================
