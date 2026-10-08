-- ============================================================
-- AUDIT: Orphaned / unreachable cost sheets (estimates) & proposals
-- ============================================================
-- Read-only. No UPDATE/DELETE statements in this file — safe to run
-- as many times as you like, including in production.
--
-- Purpose: decide whether "/estimates" can become a proposals-only
-- list, and whether cost sheets can be made reachable ONLY through
-- a project or customer file, without stranding any existing data.
--
-- Run each numbered block individually in the Supabase SQL Editor
-- (or all at once — each is a separate SELECT).
-- ============================================================


-- ────────────────────────────────────────────────────────────
-- 1. REACHABILITY SUMMARY
--    How many estimates are reachable via project, via customer,
--    via both, or via NEITHER (fully orphaned)?
-- ────────────────────────────────────────────────────────────
SELECT
  COUNT(*) FILTER (WHERE project_id IS NOT NULL AND customer_id IS NOT NULL) AS reachable_via_both,
  COUNT(*) FILTER (WHERE project_id IS NOT NULL AND customer_id IS NULL)     AS reachable_via_project_only,
  COUNT(*) FILTER (WHERE project_id IS NULL AND customer_id IS NOT NULL)     AS reachable_via_customer_only,
  COUNT(*) FILTER (WHERE project_id IS NULL AND customer_id IS NULL)         AS fully_orphaned,
  COUNT(*)                                                                    AS total_estimates
FROM estimates;


-- ────────────────────────────────────────────────────────────
-- 2. THE ORPHAN LIST
--    Every estimate with no project_id AND no customer_id.
--    Lets us eyeball whether these are real jobs or stale drafts.
-- ────────────────────────────────────────────────────────────
SELECT
  id,
  estimate_number,
  estimate_type,
  project_name,
  customer_name,
  total,
  status,
  created_at
FROM estimates
WHERE project_id IS NULL
  AND customer_id IS NULL
ORDER BY created_at DESC;


-- ────────────────────────────────────────────────────────────
-- 3. NAME-MATCH RESCUE CHECK
--    Of the orphans above, how many could be auto-linked to an
--    existing project by matching project_name (case/whitespace
--    insensitive), the same approach BACKFILL_PROJECT_ESTIMATES.sql
--    already uses? Splits "rescuable" from "truly stranded".
-- ────────────────────────────────────────────────────────────
SELECT
  e.id,
  e.estimate_number,
  e.project_name AS estimate_project_name,
  p.id           AS matchable_project_id,
  p.name         AS matched_project_name
FROM estimates e
LEFT JOIN projects p
  ON LOWER(TRIM(p.name)) = LOWER(TRIM(e.project_name))
WHERE e.project_id IS NULL
  AND e.customer_id IS NULL
  AND e.project_name IS NOT NULL
  AND e.project_name != ''
  AND e.project_name != 'Quick Estimate'
ORDER BY (p.id IS NOT NULL) DESC, e.created_at DESC;

-- Rollup: rescuable vs. truly stranded
SELECT
  COUNT(*) FILTER (WHERE p.id IS NOT NULL) AS rescuable_by_name_match,
  COUNT(*) FILTER (WHERE p.id IS NULL)     AS truly_stranded
FROM estimates e
LEFT JOIN projects p
  ON LOWER(TRIM(p.name)) = LOWER(TRIM(e.project_name))
WHERE e.project_id IS NULL
  AND e.customer_id IS NULL;


-- ────────────────────────────────────────────────────────────
-- 4. QUICK vs. FULL SPLIT (among orphans)
--    If orphans are almost all 'quick', Quick Estimate is the leak
--    and the fix is scoping it to a customer/project at creation.
-- ────────────────────────────────────────────────────────────
SELECT
  COALESCE(estimate_type, 'quick') AS estimate_type,
  COUNT(*) AS orphan_count
FROM estimates
WHERE project_id IS NULL
  AND customer_id IS NULL
GROUP BY COALESCE(estimate_type, 'quick')
ORDER BY orphan_count DESC;


-- ────────────────────────────────────────────────────────────
-- 5. PROPOSAL COVERAGE PER COST SHEET
--    How many cost sheets have 0, 1, or 2+ proposals built from them?
--    Validates the commercial (many proposals) vs residential (one)
--    split with real data, and shows how many jobs have NO proposal
--    yet — those would vanish from "/estimates" if it only lists
--    proposals, unless we add an "awaiting proposal" view.
-- ────────────────────────────────────────────────────────────
SELECT
  proposal_count_bucket,
  COUNT(*) AS cost_sheet_count
FROM (
  SELECT
    e.id,
    CASE
      WHEN COUNT(p.id) = 0 THEN '0 — no proposal yet'
      WHEN COUNT(p.id) = 1 THEN '1 — one proposal (typical residential)'
      ELSE '2+ — multiple proposals (typical commercial)'
    END AS proposal_count_bucket
  FROM estimates e
  LEFT JOIN proposals p ON p.base_estimate_id = e.id
  GROUP BY e.id
) sub
GROUP BY proposal_count_bucket
ORDER BY proposal_count_bucket;


-- ────────────────────────────────────────────────────────────
-- 6. ORPHANED PROPOSALS
--    Proposals whose base_estimate_id is NULL or points at a
--    deleted/missing estimate. These would have no cost sheet to
--    open from under the new model, so they need separate handling.
-- ────────────────────────────────────────────────────────────
SELECT
  pr.id,
  pr.proposal_number,
  pr.base_estimate_id,
  pr.project_id,
  pr.contractor_name,
  pr.total_amount,
  pr.status,
  pr.created_at,
  CASE
    WHEN pr.base_estimate_id IS NULL THEN 'no base_estimate_id set'
    WHEN e.id IS NULL THEN 'base_estimate_id points at missing/deleted estimate'
  END AS orphan_reason
FROM proposals pr
LEFT JOIN estimates e ON e.id = pr.base_estimate_id
WHERE pr.base_estimate_id IS NULL
   OR e.id IS NULL
ORDER BY pr.created_at DESC;
