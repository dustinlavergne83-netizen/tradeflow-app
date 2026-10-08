-- ============================================================
-- BACKFILL: Link the 8 orphaned Quick Estimates to a real
-- project_id and/or customer_id.
-- ============================================================
-- REWRITTEN (2026-10) after two schema-drift discoveries that
-- invalidated earlier versions of this script:
--
-- 1. customers' real display-name column is "customer", not
--    "name" ("name" is unused legacy, NOT NULL default '').
--
-- 2. estimates.company_id is STALE on these 8 rows — it holds the
--    old pre-multi-tenant value (the owner's auth.users id,
--    3c75eb59-0549-46cb-b8d2-3a006a7a6c9a = dustin@dmlelectrical.com),
--    NOT a real companies.id. customers.company_id and
--    projects.company_id both have hard FKs to companies(id), so:
--      a) every earlier match query comparing
--         "p.company_id = e.company_id" or "c.company_id = e.company_id"
--         could NEVER match anything — stale user-id vs real
--         company-id — regardless of whether a same-named
--         customer/project already existed. The earlier "zero
--         matches" result was unreliable for this reason.
--      b) the STEP 7 INSERT failed with a foreign key violation
--         because it copied e.company_id (the stale id) straight
--         into customers.company_id.
--
-- FIX: resolve the real company_id via employees.user_id ->
-- employees.company_id (the same mapping the app's own
-- get_my_company_id() function uses) and use THAT everywhere
-- below, instead of estimates.company_id directly. Confirmed this
-- resolves to 9a999997-7109-4239-9c4b-a6d94dd003b6 (DML, slug "dml").
--
-- Run the PREVIEW queries first (1, 2, 2b, 3). Only run the
-- INSERT/UPDATE statements (4, 5, 6) after confirming results,
-- then STEP 7 to confirm zero rows remain orphaned.
-- ============================================================


-- ────────────────────────────────────────────────────────────
-- STEP 1 — PREVIEW: which orphans match an EXISTING project by
--          name, using the RESOLVED (real) company_id — joining
--          through employees.user_id -> employees.company_id
--          instead of trusting estimates.company_id directly.
-- ────────────────────────────────────────────────────────────
SELECT
  e.id,
  e.estimate_number,
  e.project_name    AS estimate_project_name,
  e.customer_name   AS estimate_customer_name,
  emp.company_id    AS resolved_company_id,
  p.id              AS matched_project_id,
  p.name            AS matched_project_name
FROM estimates e
JOIN employees emp ON emp.user_id = e.company_id
LEFT JOIN projects p
  ON LOWER(TRIM(p.name)) = LOWER(TRIM(e.project_name))
  AND p.company_id = emp.company_id
WHERE e.project_id IS NULL
  AND e.customer_id IS NULL
ORDER BY e.estimate_number;


-- ────────────────────────────────────────────────────────────
-- STEP 2 — PREVIEW: which orphans match a customer by name?
--          ⚠️ CORRECTED: the live "customers" table uses a
--          "customer" column as the real display name — "name"
--          is a legacy NOT NULL column (defaults to '') that the
--          current app (Customers.jsx) never populates. Every
--          match below must compare against customers.customer,
--          not customers.name, or it will silently match nothing.
-- ────────────────────────────────────────────────────────────
SELECT
  e.id,
  e.estimate_number,
  e.customer_name   AS estimate_customer_name,
  emp.company_id    AS resolved_company_id,
  c.id              AS matched_customer_id,
  c.customer        AS matched_customer_name
FROM estimates e
JOIN employees emp ON emp.user_id = e.company_id
LEFT JOIN customers c
  ON LOWER(TRIM(c.customer)) = LOWER(TRIM(e.customer_name))
  AND c.company_id = emp.company_id
WHERE e.project_id IS NULL
  AND e.customer_id IS NULL
ORDER BY e.estimate_number;


-- ────────────────────────────────────────────────────────────
-- STEP 2b — FUZZY check: same as STEP 2 but case/whitespace AND
--           punctuation-insensitive (handles things like
--           "Jeff's AC" vs "Jeffs AC" vs "JEFF'S A/C").
--           Run this too — don't rely on STEP 2 alone before
--           deciding these customers don't already exist.
-- ────────────────────────────────────────────────────────────
SELECT
  e.id,
  e.estimate_number,
  e.customer_name   AS estimate_customer_name,
  c.id              AS fuzzy_matched_customer_id,
  c.customer        AS fuzzy_matched_customer_name
FROM estimates e
JOIN employees emp ON emp.user_id = e.company_id
LEFT JOIN customers c
  ON REGEXP_REPLACE(LOWER(c.customer), '[^a-z0-9]', '', 'g')
     = REGEXP_REPLACE(LOWER(e.customer_name), '[^a-z0-9]', '', 'g')
  AND c.company_id = emp.company_id
WHERE e.project_id IS NULL
  AND e.customer_id IS NULL
ORDER BY e.estimate_number;


-- ════════════════════════════════════════════════════════════
-- STOP: only proceed past this point once STEP 1/2/2b results
-- are reviewed. If a customer match already exists (STEP 2/2b),
-- STEP 4's NOT EXISTS guard will correctly skip creating a
-- duplicate for it — STEP 6 links it either way.
-- ════════════════════════════════════════════════════════════


-- ────────────────────────────────────────────────────────────
-- STEP 3 — PREVIEW: the 8 distinct customer names STEP 4 will
--          consider (eyeball for typos before creating anything —
--          4 of these already exist per STEP 2b and will be
--          skipped automatically by STEP 4's guard)
-- ────────────────────────────────────────────────────────────
SELECT DISTINCT emp.company_id AS resolved_company_id, e.customer_name
FROM estimates e
JOIN employees emp ON emp.user_id = e.company_id
WHERE e.project_id IS NULL AND e.customer_id IS NULL AND e.customer_name IS NOT NULL
ORDER BY e.customer_name;


-- ============================================================
-- DECISION (2026-10): STEP 1 found 0 project-name matches for all
-- 8. STEP 2b (fuzzy) found 4 of 8 customers ALREADY EXIST under
-- slightly different punctuation (e.g. "Elite Sports Lighting,LLC"
-- vs the stored "Elite Sports Lighting,LLC" with different comma
-- spacing, "Jeff's AC", "Guillory's Insulation", "Vermillion Vision
-- Eye Clinic"). These 8 look like one-off service calls rather than
-- formal multi-phase jobs, so: customer-only linking — create/link
-- customers, do NOT create project rows. Each estimate becomes
-- reachable via its Customer file, consistent with the "project OR
-- customer" access model.
-- ============================================================


-- ────────────────────────────────────────────────────────────
-- STEP 4 — CREATE customers for the 4 that truly don't exist yet
--          (Joshua Phipps, 519 Zigler, Byron Reed, Danny Breaux).
--          Uses the RESOLVED company_id. Guard uses the FUZZY
--          (punctuation-insensitive) comparison — not exact — so
--          this does NOT create duplicates for the 4 that already
--          exist under slightly different punctuation.
--          (uncomment to run)
-- ────────────────────────────────────────────────────────────
-- INSERT INTO customers (company_id, customer, name)
-- SELECT DISTINCT emp.company_id, e.customer_name, e.customer_name
-- FROM estimates e
-- JOIN employees emp ON emp.user_id = e.company_id
-- WHERE e.project_id IS NULL
--   AND e.customer_id IS NULL
--   AND e.customer_name IS NOT NULL
--   AND NOT EXISTS (
--     SELECT 1 FROM customers c
--     WHERE c.company_id = emp.company_id
--       AND REGEXP_REPLACE(LOWER(c.customer), '[^a-z0-9]', '', 'g')
--           = REGEXP_REPLACE(LOWER(e.customer_name), '[^a-z0-9]', '', 'g')
--   );


-- ────────────────────────────────────────────────────────────
-- STEP 6 — LINK: attach customer_id to all 8 estimates, matching
--          via the FUZZY comparison within the RESOLVED company_id
--          (covers both the 4 pre-existing customers from STEP 2b
--          and the 4 just created in STEP 4). project_id is
--          deliberately left NULL — no project rows are created.
--          (uncomment to run, after STEP 4 above)
-- ────────────────────────────────────────────────────────────
-- UPDATE estimates e
-- SET customer_id = c.id
-- FROM employees emp, customers c
-- WHERE emp.user_id = e.company_id
--   AND c.company_id = emp.company_id
--   AND REGEXP_REPLACE(LOWER(c.customer), '[^a-z0-9]', '', 'g')
--       = REGEXP_REPLACE(LOWER(e.customer_name), '[^a-z0-9]', '', 'g')
--   AND e.customer_id IS NULL;


-- ────────────────────────────────────────────────────────────
-- STEP 7 — FINAL CHECK: should return 0 rows.
--          NOTE: checks customer_id only, not project_id — by
--          design (per the 2026-10 decision above) these 8 are
--          being linked to a customer only, with no project
--          created. project_id will remain NULL on purpose, so
--          it is correctly excluded from this success check.
-- ────────────────────────────────────────────────────────────
-- SELECT id, estimate_number, project_name, customer_name
-- FROM estimates
-- WHERE project_id IS NULL AND customer_id IS NULL;

-- SELECT id, estimate_number, customer_name, customer_id
-- FROM estimates
-- WHERE customer_id IS NULL
--   AND id IN (
--     '9d21835b-4674-41b1-967d-eb6d8ef6f52f', '05f4546f-ca39-486b-b7bc-b0df313fd5fd',
--     '089ae0d0-9c90-4e5b-a5ed-61e1513a1e98', '2ef03336-5587-4f83-8498-70cd119d4c76',
--     '65ba1b95-7785-40e2-b12f-3d46fa94352e', 'b2eb58fe-1a0b-43fc-8ddd-882bcefe5a77',
--     '7bd9f7b4-8901-45c2-b35f-767ddc6cc3f2', '0efd9989-a0d6-45a2-8995-4589b30e9f3e'
--   );
