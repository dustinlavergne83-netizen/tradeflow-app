-- ============================================================
-- FIX: Re-link "Levittown Baseball Complex" records
--      to the renamed project "Mills Creek Baseball Complex"
--
-- Schema:
--   invoices       → project_name (text)
--   estimates      → project_name (text)
--   change_orders  → project_name (text)
--   proposals      → project_id  (uuid FK to projects)
-- ============================================================

-- ── Step 1: Preview counts ──────────────────────────────────
SELECT 'invoices' AS table_name, COUNT(*) AS records_to_update
  FROM invoices WHERE project_name ILIKE '%Levittown Baseball%'
UNION ALL
SELECT 'estimates', COUNT(*)
  FROM estimates WHERE project_name ILIKE '%Levittown Baseball%'
UNION ALL
SELECT 'change_orders', COUNT(*)
  FROM change_orders WHERE project_name ILIKE '%Levittown Baseball%'
UNION ALL
SELECT 'proposals (via project_id)', COUNT(*)
  FROM proposals
 WHERE project_id IN (
   SELECT id FROM projects WHERE name ILIKE '%Levittown Baseball%'
 );

-- ── Step 2: Update invoices ─────────────────────────────────
UPDATE invoices
   SET project_name = 'Mills Creek Baseball Complex'
 WHERE project_name ILIKE '%Levittown Baseball%';

-- ── Step 3: Update estimates ────────────────────────────────
UPDATE estimates
   SET project_name = 'Mills Creek Baseball Complex'
 WHERE project_name ILIKE '%Levittown Baseball%';

-- ── Step 4: Update change_orders ───────────────────────────
UPDATE change_orders
   SET project_name = 'Mills Creek Baseball Complex'
 WHERE project_name ILIKE '%Levittown Baseball%';

-- ── Step 5: Update proposals (uses project_id FK) ──────────
-- Only needed if TWO separate project rows exist.
-- If the project was simply renamed, proposals already point
-- to the correct project row — skip this step.
UPDATE proposals
   SET project_id = (
     SELECT id FROM projects WHERE name ILIKE '%Mills Creek Baseball%' LIMIT 1
   )
 WHERE project_id IN (
   SELECT id FROM projects WHERE name ILIKE '%Levittown Baseball%'
 );

-- ── Step 6: Confirm results ─────────────────────────────────
SELECT 'invoices updated' AS result, COUNT(*) AS count
  FROM invoices WHERE project_name = 'Mills Creek Baseball Complex'
UNION ALL
SELECT 'estimates updated', COUNT(*)
  FROM estimates WHERE project_name = 'Mills Creek Baseball Complex'
UNION ALL
SELECT 'change_orders updated', COUNT(*)
  FROM change_orders WHERE project_name = 'Mills Creek Baseball Complex';
