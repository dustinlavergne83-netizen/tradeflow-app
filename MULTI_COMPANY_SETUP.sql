-- ============================================================
-- MULTI-COMPANY SETUP: Make TimeClock ready for other companies
-- ============================================================
-- Run this in Supabase SQL Editor
-- This creates the companies table, ensures company_id on all
-- key tables, backfills existing data, and adds RLS policies.
-- ============================================================

-- ==========================================
-- STEP 1: Create the companies table
-- ==========================================
CREATE TABLE IF NOT EXISTS companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE, -- e.g. "dml-electrical" for URL-friendly name
  logo_url TEXT,
  primary_color TEXT DEFAULT '#0b3ea8',
  secondary_color TEXT DEFAULT '#fc6b04',
  contact_email TEXT,
  contact_phone TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  zip TEXT,
  website TEXT,
  subscription_tier TEXT DEFAULT 'basic', -- basic, pro, enterprise
  subscription_status TEXT DEFAULT 'active', -- active, trial, suspended, cancelled
  trial_ends_at TIMESTAMPTZ,
  max_employees INTEGER DEFAULT 50,
  settings JSONB DEFAULT '{}', -- flexible settings (pay period, overtime rules, etc.)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_companies_slug ON companies(slug);

-- ==========================================
-- STEP 2: Create YOUR company record (DML Electrical)
-- Replace the admin_user_id below with your actual admin auth UID
-- ==========================================

-- First, let's find your admin user ID
-- SELECT id, email FROM auth.users WHERE email LIKE '%dml%' OR email LIKE '%dustin%' LIMIT 5;

-- Insert DML Electrical as the first company
INSERT INTO companies (name, slug, primary_color, secondary_color, contact_email, subscription_tier, subscription_status)
VALUES (
  'DML Electrical Service, LLC',
  'dml-electrical',
  '#0b3ea8',
  '#fc6b04',
  'timeclock@dmlelectrical.com',
  'enterprise',
  'active'
)
ON CONFLICT (slug) DO NOTHING;

-- ==========================================
-- STEP 3: Add company_id to employees (if not exists)
-- ==========================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'employees' AND column_name = 'company_id'
  ) THEN
    ALTER TABLE employees ADD COLUMN company_id UUID REFERENCES companies(id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_employees_company_id ON employees(company_id);

-- ==========================================
-- STEP 4: Add company_id to shifts (if not exists)
-- ==========================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'shifts' AND column_name = 'company_id'
  ) THEN
    ALTER TABLE shifts ADD COLUMN company_id UUID REFERENCES companies(id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_shifts_company_id ON shifts(company_id);

-- ==========================================
-- STEP 5: Add company_id to shift_segments (if not exists)
-- ==========================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'shift_segments' AND column_name = 'company_id'
  ) THEN
    ALTER TABLE shift_segments ADD COLUMN company_id UUID REFERENCES companies(id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_shift_segments_company_id ON shift_segments(company_id);

-- ==========================================
-- STEP 6: Add company_id to projects (if not exists)
-- ==========================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'projects' AND column_name = 'company_id'
  ) THEN
    ALTER TABLE projects ADD COLUMN company_id UUID REFERENCES companies(id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_projects_company_id ON projects(company_id);

-- ==========================================
-- STEP 7: Add company_id to time_entries (if not exists)
-- ==========================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'time_entries' AND column_name = 'company_id'
  ) THEN
    ALTER TABLE time_entries ADD COLUMN company_id UUID REFERENCES companies(id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_time_entries_company_id ON time_entries(company_id);

-- ==========================================
-- STEP 8: Add company_id to location_history (if not exists)
-- ==========================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'location_history' AND column_name = 'company_id'
  ) THEN
    ALTER TABLE location_history ADD COLUMN company_id UUID REFERENCES companies(id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_location_history_company_id ON location_history(company_id);

-- ==========================================
-- STEP 9: Add company_id to geofence_events (if not exists)
-- ==========================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'geofence_events' AND column_name = 'company_id'
  ) THEN
    ALTER TABLE geofence_events ADD COLUMN company_id UUID REFERENCES companies(id);
  END IF;
END $$;

-- ==========================================
-- STEP 10: Add company_id to time_off_requests (if not exists)
-- ==========================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'time_off_requests' AND column_name = 'company_id'
  ) THEN
    ALTER TABLE time_off_requests ADD COLUMN company_id UUID REFERENCES companies(id);
  END IF;
END $$;

-- ==========================================
-- STEP 11: Add company_id to employee_push_tokens (if not exists)
-- ==========================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'employee_push_tokens' AND column_name = 'company_id'
  ) THEN
    ALTER TABLE employee_push_tokens ADD COLUMN company_id UUID REFERENCES companies(id);
  END IF;
END $$;

-- ==========================================
-- STEP 12: Backfill all existing data with DML company ID
-- ==========================================
DO $$
DECLARE
  dml_company_id UUID;
BEGIN
  SELECT id INTO dml_company_id FROM companies WHERE slug = 'dml-electrical' LIMIT 1;
  
  IF dml_company_id IS NOT NULL THEN
    -- Backfill employees
    UPDATE employees SET company_id = dml_company_id WHERE company_id IS NULL;
    
    -- Backfill shifts
    UPDATE shifts SET company_id = dml_company_id WHERE company_id IS NULL;
    
    -- Backfill shift_segments
    UPDATE shift_segments SET company_id = dml_company_id WHERE company_id IS NULL;
    
    -- Backfill projects
    UPDATE projects SET company_id = dml_company_id WHERE company_id IS NULL;
    
    -- Backfill time_entries
    UPDATE time_entries SET company_id = dml_company_id WHERE company_id IS NULL;
    
    -- Backfill location_history
    UPDATE location_history SET company_id = dml_company_id WHERE company_id IS NULL;
    
    -- Backfill geofence_events
    UPDATE geofence_events SET company_id = dml_company_id WHERE company_id IS NULL;
    
    -- Backfill time_off_requests
    UPDATE time_off_requests SET company_id = dml_company_id WHERE company_id IS NULL;
    
    -- Backfill employee_push_tokens
    UPDATE employee_push_tokens SET company_id = dml_company_id WHERE company_id IS NULL;
    
    RAISE NOTICE 'Backfill complete for company: %', dml_company_id;
  ELSE
    RAISE NOTICE 'DML company not found — skipping backfill';
  END IF;
END $$;

-- ==========================================
-- STEP 13: Enable RLS on companies table
-- ==========================================
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;

-- Companies: users can read their own company
DROP POLICY IF EXISTS "Users can read own company" ON companies;
CREATE POLICY "Users can read own company" ON companies
  FOR SELECT USING (
    id IN (
      SELECT company_id FROM employees WHERE user_id = auth.uid()
    )
  );

-- ==========================================
-- STEP 14: Add RLS policies for company-scoped tables
-- ==========================================

-- EMPLOYEES: users see only their company's employees
DROP POLICY IF EXISTS "employees_company_isolation" ON employees;
CREATE POLICY "employees_company_isolation" ON employees
  FOR ALL USING (
    company_id IN (
      SELECT e.company_id FROM employees e WHERE e.user_id = auth.uid()
    )
  );

-- SHIFTS: users see only their company's shifts
DROP POLICY IF EXISTS "shifts_company_isolation" ON shifts;
CREATE POLICY "shifts_company_isolation" ON shifts
  FOR ALL USING (
    company_id IN (
      SELECT e.company_id FROM employees e WHERE e.user_id = auth.uid()
    )
  );

-- SHIFT_SEGMENTS: users see only their company's segments
DROP POLICY IF EXISTS "shift_segments_company_isolation" ON shift_segments;
CREATE POLICY "shift_segments_company_isolation" ON shift_segments
  FOR ALL USING (
    company_id IN (
      SELECT e.company_id FROM employees e WHERE e.user_id = auth.uid()
    )
  );

-- PROJECTS: users see only their company's projects
DROP POLICY IF EXISTS "projects_company_isolation" ON projects;
CREATE POLICY "projects_company_isolation" ON projects
  FOR ALL USING (
    company_id IN (
      SELECT e.company_id FROM employees e WHERE e.user_id = auth.uid()
    )
  );

-- TIME_ENTRIES: users see only their company's time entries
DROP POLICY IF EXISTS "time_entries_company_isolation" ON time_entries;
CREATE POLICY "time_entries_company_isolation" ON time_entries
  FOR ALL USING (
    company_id IN (
      SELECT e.company_id FROM employees e WHERE e.user_id = auth.uid()
    )
  );

-- LOCATION_HISTORY: users see only their company's location data
DROP POLICY IF EXISTS "location_history_company_isolation" ON location_history;
CREATE POLICY "location_history_company_isolation" ON location_history
  FOR ALL USING (
    company_id IN (
      SELECT e.company_id FROM employees e WHERE e.user_id = auth.uid()
    )
  );

-- ==========================================
-- STEP 15: Helper function to get current user's company_id
-- ==========================================
CREATE OR REPLACE FUNCTION get_my_company_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT company_id FROM employees WHERE user_id = auth.uid() LIMIT 1;
$$;

-- ==========================================
-- VERIFICATION: Check the setup
-- ==========================================
SELECT * FROM companies;
SELECT id, email, first_name, last_name, company_id FROM employees LIMIT 10;
SELECT id, clock_in, company_id FROM shifts LIMIT 5;
SELECT id, start_at, company_id FROM shift_segments LIMIT 5;
SELECT id, name, company_id FROM projects LIMIT 5;
