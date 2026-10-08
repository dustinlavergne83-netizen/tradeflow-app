-- ============================================================
-- GENERALIZED: Audit + backfill orphaned cost sheets (estimates)
-- for ANY company by slug.
-- ============================================================
-- This is the reusable version of AUDIT_ORPHANED_COST_SHEETS.sql +
-- BACKFILL_ORPHANED_QUICK_ESTIMATES.sql, which were written
-- specifically for DML. Those scripts hardcoded DML's resolved
-- company_id after discovering that estimates.company_id can be
-- STALE (a pre-multi-tenant auth.users id instead of a real
-- companies.id) — see those files' headers for the full story.
--
-- This version resolves everything from a single slug at the top,
-- so it works for DT Specialties (slug 'dt-specialties') or any
-- other company without manual edits.
--
-- IMPORTANT: unlike DML, DT Specialties may be a newer company
-- whose estimates.company_id was ALWAYS set correctly (never went
-- through the old pre-companies-table convention). The queries
-- below work either way — they resolve the real company_id fresh
-- each time via employees, rather than assuming estimates.company_id
-- is stale.
--
-- Run Section 1 (audit) first. Only run Section 2 (backfill) if
-- Section 1 shows orphans.
-- ============================================================

-- ─── SET THE TARGET COMPANY HERE ─────────────────────────────
-- Change this one value to run against a different company.
-- (Postgres doesn't support script-level variables in plain SQL
-- the way psql \set does, so this is repeated as a subquery in
-- each statement below — look for `(SELECT id FROM companies
-- WHERE slug = 'dt-specialties')` and swap the slug if needed.)


-- ════════════════════════════════════════════════════════════
-- SECTION 1 — AUDIT (read-only, safe to run anytime)
-- ════════════════════════════════════════════════════════════

-- 1a. Confirm the company resolves and see its real id
SELECT id, name, slug FROM companies WHERE slug = 'dt-specialties';

-- 1b. IMPORTANT CHECK — unlike DML, DT may be new enough that
--     estimates.company_id was NEVER stale (always the real
--     companies.id directly, no employees-join needed). Find out
--     which pattern applies before trusting 1c/1d below.
--     "direct_match_count" = estimates where company_id IS ALREADY
--     the real companies.id. "stale_match_count" = estimates where
--     company_id is an old-style auth.users id that resolves to
--     this company only via the employees table (DML's situation).
SELECT
  (SELECT COUNT(*) FROM estimates
     WHERE company_id = (SELECT id FROM companies WHERE slug = 'dt-specialties')
  ) AS direct_match_count,
  (SELECT COUNT(*) FROM estimates e
     JOIN employees emp ON emp.user_id = e.company_id
     WHERE emp.company_id = (SELECT id FROM companies WHERE slug = 'dt-specialties')
       AND e.company_id <> (SELECT id FROM companies WHERE slug = 'dt-specialties')
  ) AS stale_match_count;

-- 1c. Reachability summary — covers BOTH patterns at once (direct
--     company_id match OR resolved via employees), so it's correct
--     regardless of which one 1b shows for this company.
SELECT
  COUNT(*) FILTER (WHERE e.project_id IS NOT NULL AND e.customer_id IS NOT NULL) AS reachable_via_both,
  COUNT(*) FILTER (WHERE e.project_id IS NOT NULL AND e.customer_id IS NULL)     AS reachable_via_project_only,
  COUNT(*) FILTER (WHERE e.project_id IS NULL AND e.customer_id IS NOT NULL)     AS reachable_via_customer_only,
  COUNT(*) FILTER (WHERE e.project_id IS NULL AND e.customer_id IS NULL)         AS fully_orphaned,
  COUNT(*) AS total_estimates_for_this_company
FROM estimates e
WHERE e.company_id = (SELECT id FROM companies WHERE slug = 'dt-specialties')
   OR e.company_id IN (
     SELECT user_id FROM employees
     WHERE company_id = (SELECT id FROM companies WHERE slug = 'dt-specialties')
   );

-- 1d. The orphan list itself (if any) — same dual-pattern match as 1c
SELECT
  e.id, e.estimate_number, e.estimate_type, e.project_name,
  e.customer_name, e.total, e.status, e.created_at
FROM estimates e
WHERE (
    e.company_id = (SELECT id FROM companies WHERE slug = 'dt-specialties')
    OR e.company_id IN (
      SELECT user_id FROM employees
      WHERE company_id = (SELECT id FROM companies WHERE slug = 'dt-specialties')
    )
  )
  AND e.project_id IS NULL
  AND e.customer_id IS NULL
ORDER BY e.created_at DESC;


-- ════════════════════════════════════════════════════════════
-- SECTION 2 — BACKFILL (only run if Section 1d returned rows)
-- Matches the DML fix: link orphans to a customer by fuzzy name
-- match, creating the customer record if none exists yet. Does
-- NOT create project rows (same call made for DML's orphans —
-- these tend to be simple one-off jobs; revisit per-company if
-- DT's orphans look like real multi-phase projects instead).
-- ════════════════════════════════════════════════════════════

-- 2a. PREVIEW — fuzzy customer match for each orphan (case/punct-
--     insensitive, scoped to this company only)
SELECT
  e.id, e.estimate_number, e.customer_name AS estimate_customer_name,
  c.id AS fuzzy_matched_customer_id, c.customer AS fuzzy_matched_customer_name
FROM estimates e
LEFT JOIN customers c
  ON REGEXP_REPLACE(LOWER(c.customer), '[^a-z0-9]', '', 'g')
     = REGEXP_REPLACE(LOWER(e.customer_name), '[^a-z0-9]', '', 'g')
  AND c.company_id = (SELECT id FROM companies WHERE slug = 'dt-specialties')
WHERE (
    e.company_id = (SELECT id FROM companies WHERE slug = 'dt-specialties')
    OR e.company_id IN (
      SELECT user_id FROM employees
      WHERE company_id = (SELECT id FROM companies WHERE slug = 'dt-specialties')
    )
  )
  AND e.project_id IS NULL
  AND e.customer_id IS NULL
ORDER BY e.estimate_number;

-- 2b. CREATE customers that truly don't exist yet (uncomment to run)
-- INSERT INTO customers (company_id, customer, name)
-- SELECT DISTINCT
--   (SELECT id FROM companies WHERE slug = 'dt-specialties'),
--   e.customer_name, e.customer_name
-- FROM estimates e
-- WHERE (
--     e.company_id = (SELECT id FROM companies WHERE slug = 'dt-specialties')
--     OR e.company_id IN (
--       SELECT user_id FROM employees
--       WHERE company_id = (SELECT id FROM companies WHERE slug = 'dt-specialties')
--     )
--   )
--   AND e.project_id IS NULL
--   AND e.customer_id IS NULL
--   AND e.customer_name IS NOT NULL
--   AND NOT EXISTS (
--     SELECT 1 FROM customers c
--     WHERE c.company_id = (SELECT id FROM companies WHERE slug = 'dt-specialties')
--       AND REGEXP_REPLACE(LOWER(c.customer), '[^a-z0-9]', '', 'g')
--           = REGEXP_REPLACE(LOWER(e.customer_name), '[^a-z0-9]', '', 'g')
--   );

-- 2c. LINK all orphans to their customer, fuzzy-matched, within
--     this company (uncomment to run, after 2b)
-- UPDATE estimates e
-- SET customer_id = c.id
-- FROM customers c
-- WHERE c.company_id = (SELECT id FROM companies WHERE slug = 'dt-specialties')
--   AND (
--     e.company_id = (SELECT id FROM companies WHERE slug = 'dt-specialties')
--     OR e.company_id IN (
--       SELECT user_id FROM employees
--       WHERE company_id = (SELECT id FROM companies WHERE slug = 'dt-specialties')
--     )
--   )
--   AND REGEXP_REPLACE(LOWER(c.customer), '[^a-z0-9]', '', 'g')
--       = REGEXP_REPLACE(LOWER(e.customer_name), '[^a-z0-9]', '', 'g')
--   AND e.customer_id IS NULL;

-- 2d. FINAL CHECK — should return 0 rows after 2b/2c
-- SELECT e.id, e.estimate_number, e.customer_name
-- FROM estimates e
-- WHERE (
--     e.company_id = (SELECT id FROM companies WHERE slug = 'dt-specialties')
--     OR e.company_id IN (
--       SELECT user_id FROM employees
--       WHERE company_id = (SELECT id FROM companies WHERE slug = 'dt-specialties')
--     )
--   )
--   AND e.project_id IS NULL
--   AND e.customer_id IS NULL;
