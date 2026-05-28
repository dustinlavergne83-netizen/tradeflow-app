-- ============================================================
-- DIAGNOSE: Test Company Data Isolation Issue
-- Run each block in Supabase SQL Editor to see what's wrong
-- ============================================================

-- ══════════════════════════════════════════════════════════════
-- BLOCK 1: See ALL companies in the system
-- ══════════════════════════════════════════════════════════════
SELECT id, name, slug, subscription_status, created_at
FROM companies
ORDER BY created_at;


-- ══════════════════════════════════════════════════════════════
-- BLOCK 2: See ALL employees and which company they belong to
-- This reveals if any users are mapped to the wrong company
-- ══════════════════════════════════════════════════════════════
SELECT
  e.id,
  e.first_name,
  e.last_name,
  e.user_id,
  e.role,
  e.company_id,
  c.name AS company_name,
  e.created_at
FROM employees e
LEFT JOIN companies c ON c.id = e.company_id
ORDER BY c.name, e.first_name;


-- ══════════════════════════════════════════════════════════════
-- BLOCK 3: Find any users with MORE THAN ONE employee row
-- (this breaks the .single() / .maybeSingle() lookup)
-- ══════════════════════════════════════════════════════════════
SELECT
  user_id,
  COUNT(*) AS row_count,
  array_agg(company_id) AS company_ids,
  array_agg(first_name || ' ' || last_name) AS names
FROM employees
WHERE user_id IS NOT NULL
GROUP BY user_id
HAVING COUNT(*) > 1;


-- ══════════════════════════════════════════════════════════════
-- BLOCK 4: See the auth users and their emails
-- (requires service role — run in Supabase SQL Editor)
-- ══════════════════════════════════════════════════════════════
SELECT
  u.id AS auth_user_id,
  u.email,
  e.first_name,
  e.last_name,
  e.company_id,
  c.name AS company_name,
  e.role
FROM auth.users u
LEFT JOIN employees e ON e.user_id = u.id
LEFT JOIN companies c ON c.id = e.company_id
ORDER BY c.name, u.email;


-- ══════════════════════════════════════════════════════════════
-- BLOCK 5: Check current RLS policies on all key tables
-- ══════════════════════════════════════════════════════════════
SELECT tablename, policyname, cmd, qual
FROM pg_policies
WHERE tablename IN ('employees', 'shifts', 'shift_segments', 'timeclock_projects', 'companies')
ORDER BY tablename, policyname;
