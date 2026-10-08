-- ============================================================
-- DT SPECIALTIES: tie 2 estimates + 1 proposal to their correct
-- customers. Customers already exist — this is a pure linking
-- job, no customer creation needed.
-- ============================================================
-- Confirmed live schema facts used below:
--   - proposals has NO customer_id / customer_name column at all
--     (only contractor_id -> project_contractors, and contractor_name
--     text). For residential-type jobs, ProposalResidentialContractor.jsx
--     already falls back to using the ESTIMATE's customer_name as
--     contractor_name — so a DT proposal's "customer" in practice
--     lives on its linked estimate (base_estimate_id), or on its
--     project (project_id -> projects.customer), not on the
--     proposal row itself.
--   - customers' real display-name column is "customer", not "name".
--   - estimates.company_id may be the stale pre-multi-tenant id or
--     the real companies.id directly (see AUDIT_AND_BACKFILL_
--     ORPHANED_ESTIMATES_BY_COMPANY.sql Section 1b for DT's result).
--     This script matches on BOTH patterns so it works either way.
-- ============================================================


-- ────────────────────────────────────────────────────────────
-- STEP 1 — SEE THE ACTUAL RECORDS: the 2 estimates + 1 proposal
--          for DT, with their current (unlinked) customer_name /
--          contractor_name text, and whether a customer already
--          exists that matches by fuzzy name.
-- ────────────────────────────────────────────────────────────
SELECT
  e.id, e.estimate_number, e.customer_name, e.customer_id,
  e.project_id, e.project_name,
  c.id AS fuzzy_matched_customer_id, c.customer AS fuzzy_matched_customer_name
FROM estimates e
LEFT JOIN customers c
  ON c.company_id = (SELECT id FROM companies WHERE slug = 'dt-specialties')
  AND REGEXP_REPLACE(LOWER(c.customer), '[^a-z0-9]', '', 'g')
     = REGEXP_REPLACE(LOWER(e.customer_name), '[^a-z0-9]', '', 'g')
WHERE e.company_id = (SELECT id FROM companies WHERE slug = 'dt-specialties')
   OR e.company_id IN (
     SELECT user_id FROM employees
     WHERE company_id = (SELECT id FROM companies WHERE slug = 'dt-specialties')
   )
ORDER BY e.created_at DESC;

-- The proposal — note it has no customer_name of its own to match on
-- directly, so this also pulls in its linked estimate's customer_name
-- (via base_estimate_id) and its linked project's customer (via
-- project_id) as the two candidate sources of truth.
SELECT
  p.id, p.proposal_number, p.contractor_name,
  p.base_estimate_id, p.project_id,
  e.customer_name AS linked_estimate_customer_name,
  e.customer_id AS linked_estimate_customer_id,
  pr.customer AS linked_project_customer_text
FROM proposals p
LEFT JOIN estimates e ON e.id = p.base_estimate_id
LEFT JOIN projects pr ON pr.id = p.project_id
WHERE p.company_id = (SELECT id FROM companies WHERE slug = 'dt-specialties')
   OR p.company_id IN (
     SELECT user_id FROM employees
     WHERE company_id = (SELECT id FROM companies WHERE slug = 'dt-specialties')
   );

-- ============================================================
-- RESULT (2026-10): both estimates (1001 Vermilion Vision,
-- 1002 Ryan Pousson) ALREADY have a non-null customer_id, and it
-- is identical to the id independently found by the fuzzy-name
-- join — i.e. they were already correctly linked (created after
-- Phase 3 shipped, which made QuickEstimate.jsx persist
-- customer_id on save). The one proposal's base_estimate_id
-- points at the Ryan Pousson estimate, which already resolves
-- correctly, so Customers.jsx's Proposals panel will pick it up
-- with no proposal-side change needed either.
--
-- CONCLUSION: DT Specialties required ZERO backfill/UPDATE
-- statements. No SQL was run against this company beyond the
-- read-only SELECTs above. Closing this out.
-- ============================================================
