-- ============================================================
-- Introspect the REAL customers table schema.
-- The backfill INSERT failed with:
--   null value in column "customer" of relation "customers"
--   violates not-null constraint
-- "customer" is not a column added by any tracked migration —
-- it was likely added directly via the Supabase Table Editor.
-- Run this to see every column, its type, nullability, and default,
-- so the backfill INSERT can be corrected to match reality.
-- ============================================================
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'customers'
ORDER BY ordinal_position;

-- ============================================================
-- RESULT (confirmed): the live "customers" table uses a "customer"
-- column (NOT NULL, text) as the real display name — this is what
-- Customers.jsx actually reads/writes/orders by. The "name" column
-- is a legacy NOT NULL column defaulting to '' that the current UI
-- never populates. Any name-match comparison against customers.name
-- was comparing against empty strings, not real data.
--
-- Also check "projects" the same way, in case it has drifted from
-- its tracked migration too (safer to know before STEP 8 runs).
-- ============================================================
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'projects'
ORDER BY ordinal_position;

-- ============================================================
-- NEW FINDING (2026-10): the STEP 7 customer INSERT failed with
--   "insert or update on table "customers" violates foreign key
--    constraint "customers_company_id_fkey""
--   Key (company_id)=(3c75eb59-...) is not present in "companies".
--
-- Root cause: BACKFILL_DML_COMPANY_ID.sql migrated company_id on
-- every table to reference the new companies(id) table, but it
-- only filled in NULL company_id values — it never overwrote rows
-- that already had an old-style value (back when company_id meant
-- "the owner's auth.users id"). These 8 orphaned estimates were
-- created before that migration and still carry the stale old ID.
--
-- Step A — see the actual companies table (expect exactly one row
-- for a single-company shop like this):
-- ============================================================
SELECT id, name, slug FROM companies ORDER BY created_at;

-- Step B — show the company_id currently stored on the 8 orphaned
-- estimates, and whether that value exists in companies at all:
SELECT
  e.id,
  e.estimate_number,
  e.company_id AS estimate_company_id,
  c.id IS NOT NULL AS exists_in_companies
FROM estimates e
LEFT JOIN companies c ON c.id = e.company_id
WHERE e.project_id IS NULL
  AND e.customer_id IS NULL
ORDER BY e.estimate_number;

-- Step C — confirm it's the OLD-style id (a real auth.users id),
-- which is what we'd expect if it predates the companies migration:
SELECT
  e.id AS estimate_id,
  e.company_id AS stale_company_id,
  u.id IS NOT NULL AS exists_in_auth_users,
  u.email
FROM estimates e
LEFT JOIN auth.users u ON u.id = e.company_id
WHERE e.project_id IS NULL
  AND e.customer_id IS NULL
ORDER BY e.estimate_number;

-- ============================================================
-- CONFIRMED: all 8 orphans' company_id = 3c75eb59-... = the auth
-- user dustin@dmlelectrical.com (stale pre-multi-tenant value).
-- The real DML company row is 9a999997-7109-4239-9c4b-a6d94dd003b6
-- (slug "dml"). customers.company_id now has a strict FK to
-- companies, so inserts must use THAT id, not the estimate's
-- stale one.
--
-- Before fixing the backfill, confirm what projects.company_id
-- actually references right now (its migration file still says
-- "REFERENCES auth.users(id)", but that may have drifted too,
-- same as customers did). Don't trust migration files — check
-- live constraints directly.
-- ============================================================
SELECT
  tc.table_name,
  kcu.column_name,
  ccu.table_name  AS references_table,
  ccu.column_name AS references_column
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu
  ON tc.constraint_name = ccu.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
  AND kcu.column_name = 'company_id'
  AND tc.table_name IN ('customers', 'projects', 'estimates', 'proposals')
ORDER BY tc.table_name;

-- ============================================================
-- CONFIRMED: customers.company_id and projects.company_id both
-- have a hard FK to companies(id). estimates/proposals.company_id
-- have NO FK at all — just a plain uuid column, which is exactly
-- why it could silently hold a stale pre-migration value (the old
-- auth.users id) for years with no error.
--
-- Rather than hardcode the DML company id, resolve it the same
-- way the app's own get_my_company_id() function does:
--   employees.user_id (old-style auth id) -> employees.company_id
--   (the real companies.id)
-- Confirm that mapping actually resolves for this user before
-- wiring it into the backfill.
-- ============================================================
SELECT
  emp.user_id,
  emp.company_id AS resolved_company_id,
  emp.email
FROM employees emp
WHERE emp.user_id = '3c75eb59-0549-46cb-b8d2-3a006a7a6c9a';

-- ============================================================
-- PHASE 1 PREP: check whether "invoices" has a customer_id FK or
-- only the free-text customer_name column (its migration file
-- only shows customer_name — but given how much drift we've
-- already found, verify live before building the Customer file's
-- Invoices panel against the wrong column).
-- ============================================================
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'invoices'
  AND column_name IN ('customer_id', 'customer_name', 'project_id', 'project_name', 'company_id')
ORDER BY column_name;

-- ============================================================
-- Also confirm estimates' live columns needed for the Customer
-- file's "Cost Sheets" panel (don't assume the migration file is
-- still accurate, given the drift already found elsewhere).
-- ============================================================
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'estimates'
  AND column_name IN ('customer_id', 'customer_name', 'project_id', 'project_name', 'company_id', 'estimate_type', 'status', 'total')
ORDER BY column_name;

-- ============================================================
-- DT SPECIALTIES (2026-10): only 2 estimates + 1 proposal total,
-- customers already exist but aren't linked — simple tie-together
-- job, no creation needed. First confirm proposals has a real
-- customer_id column (no tracked migration mentions one — only
-- contractor_id/contractor_name from 013_proposals_table.sql —
-- so check live before writing the fix).
-- ============================================================
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'proposals'
  AND column_name IN ('customer_id', 'customer_name', 'contractor_id', 'contractor_name', 'base_estimate_id', 'project_id', 'company_id')
ORDER BY column_name;
