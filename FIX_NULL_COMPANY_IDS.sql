-- ============================================================
-- FIX: Employees with NULL company_id
-- These employees can't log in properly — they need a company.
-- ============================================================
-- Run BLOCK 1 first to confirm the issue, then BLOCK 2 or 3
-- depending on which company they should belong to.
-- ============================================================


-- ══════════════════════════════════════════════════════════════
-- BLOCK 1: See which employees still have null company_id
-- ══════════════════════════════════════════════════════════════
SELECT id, first_name, last_name, user_id, company_id, created_at
FROM employees
WHERE company_id IS NULL
ORDER BY first_name;


-- ══════════════════════════════════════════════════════════════
-- BLOCK 2: Check which auth account each null-company employee is
-- (so we know which company to assign them to)
-- ══════════════════════════════════════════════════════════════
SELECT
  u.email,
  u.id AS auth_user_id,
  e.first_name,
  e.last_name,
  e.company_id
FROM auth.users u
JOIN employees e ON e.user_id = u.id
WHERE e.company_id IS NULL;


-- ══════════════════════════════════════════════════════════════
-- BLOCK 3: See all companies so you can pick the right one
-- ══════════════════════════════════════════════════════════════
SELECT id, name, slug, subscription_status
FROM companies
ORDER BY name;


-- ══════════════════════════════════════════════════════════════
-- BLOCK 4a: Fix dmltester95 — assign to DML Electrical
-- (run this if dmltester95 is a DML test account)
-- ══════════════════════════════════════════════════════════════
UPDATE employees
SET company_id = (SELECT id FROM companies WHERE slug = 'dml-electrical' LIMIT 1)
WHERE first_name = 'dmltester95'
  AND company_id IS NULL;


-- ══════════════════════════════════════════════════════════════
-- BLOCK 4b: Fix tyweldon8898 — assign to DML Electrical
-- (run this if tyweldon8898 is Ty Weldon's DML test account)
-- ══════════════════════════════════════════════════════════════
UPDATE employees
SET company_id = (SELECT id FROM companies WHERE slug = 'dml-electrical' LIMIT 1)
WHERE first_name = 'tyweldon8898'
  AND company_id IS NULL;


-- ══════════════════════════════════════════════════════════════
-- BLOCK 5: Assign a null-company employee to a SPECIFIC company
-- Use this if the employee should belong to a non-DML company.
-- Replace YOUR-COMPANY-ID-HERE with the id from BLOCK 3.
-- ══════════════════════════════════════════════════════════════
-- UPDATE employees
-- SET company_id = 'YOUR-COMPANY-ID-HERE'
-- WHERE first_name = 'dmltester95'
--   AND company_id IS NULL;


-- ══════════════════════════════════════════════════════════════
-- BLOCK 6: Verify — no more nulls
-- ══════════════════════════════════════════════════════════════
SELECT id, first_name, last_name, company_id
FROM employees
WHERE company_id IS NULL;
-- Should return 0 rows after the fix
