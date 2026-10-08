-- ============================================================================
-- BACKFILL: September 2026 project-tagged bank withdrawals → expenses
-- ============================================================================
-- Problem: cleared bank_transactions that had a Project selected (project_id)
-- but no match/link were never turned into a real `expenses` row, so they
-- never showed up on that project's job-costing total (ProjectDetail.jsx /
-- ProjectsList.jsx only sum the `expenses` + `project_expenses` tables).
-- Going forward this is fixed in src/pages/BankTransactions.jsx (see
-- createExpenseFromTransaction / onClickClearButton / handleClearSelected).
-- This script is a ONE-TIME catch-up for transactions that already cleared
-- in September 2026 on the main checking account, before that fix existed.
--
-- Mirrors the exact field mapping used by createExpenseFromTransaction:
--   expense_date   <- transaction_date
--   amount         <- ABS(amount)
--   category       <- accounts.account_name (resolved from the category UUID)
--   vendor         <- payee
--   description    <- description
--   payment_method <- 'bank'
--   bank_account_id<- bank_transactions.bank_account_id
--   project_id     <- bank_transactions.project_id
--   project_name   <- projects.name
--   tax_deductible <- true
--
-- Then links back via linked_expense_id + auto_created_expense = true, which
-- is EXACTLY what createExpenseFromTransaction does, and is what the
-- de-dup filters in Expenses.jsx (loadClearedBankExpenses L307, loadThisMonthTotal
-- L402) key off of — so these transactions stop being double-counted the
-- moment this script runs.
--
-- Run each STEP in order. Steps 1-2 are read-only -- review their output
-- before running STEP 3/4. Everything is wrapped in a transaction so you
-- can ROLLBACK instead of COMMIT if anything looks wrong.
-- ============================================================================


-- ============================================================================
-- STEP 1 -- Identify "main checking" (read-only)
-- ============================================================================
-- Run this first and confirm the correct id before continuing. If you
-- already know the bank_account_id, skip to Step 2 and hardcode it there.
SELECT
  ba.id            AS bank_account_id,
  ba.account_name,
  ba.bank_name,
  ba.account_type,
  ba.current_balance,
  coa.account_number,
  coa.account_name AS chart_account_name
FROM bank_accounts ba
LEFT JOIN accounts coa ON coa.id = ba.chart_account_id
WHERE ba.account_type ILIKE '%checking%'
   OR ba.account_name  ILIKE '%checking%'
   OR ba.account_name  ILIKE '%main%'
ORDER BY ba.account_name;


-- ============================================================================
-- STEP 2 -- Dry run: preview exactly what would be created (read-only)
-- ============================================================================
-- Confirmed main checking account id from Step 1 (note the quotes -- a UUID
-- is a string literal; without quotes Postgres reads the hyphens as
-- subtraction and throws a syntax error):
WITH main_checking AS (
  SELECT '8815abd9-a681-4c81-857c-753a9e13e23d'::uuid AS id
)
SELECT
  bt.id                AS bank_transaction_id,
  bt.transaction_date,
  bt.amount,
  bt.payee,
  bt.description,
  bt.project_id,
  p.name                AS project_name,
  bt.category          AS category_account_id,
  coa.account_name      AS category_account_name
FROM bank_transactions bt
JOIN main_checking mc        ON mc.id = bt.bank_account_id
LEFT JOIN projects p          ON p.id = bt.project_id
-- bank_transactions.category is VARCHAR(100), not UUID (see migration
-- 026_create_bank_accounts_tables.sql) -- it just happens to hold an
-- accounts.id UUID as text. Cast explicitly, and only when it actually
-- looks like a UUID, so a stray legacy non-UUID value can't abort the query.
LEFT JOIN accounts coa        ON bt.category ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                              AND coa.id = bt.category::uuid
WHERE bt.is_cleared = true
  AND bt.amount < 0
  AND bt.project_id IS NOT NULL
  AND bt.linked_expense_id IS NULL
  AND bt.linked_invoice_id IS NULL
  AND bt.linked_bill_id IS NULL
  AND bt.transaction_date >= '2026-09-01'
  AND bt.transaction_date <  '2026-10-01'
ORDER BY bt.transaction_date;

-- STOP HERE and review the preview above before running STEP 3.
-- Rows with category_account_name = NULL have no Category set -- the real
-- BankTransactions.jsx flow would have blocked clearing those without one,
-- so the INSERT below also skips any row where bt.category IS NULL.


-- ============================================================================
-- STEP 3 -- Create the expense rows + link them back (writes, transactional)
-- ============================================================================
BEGIN;

WITH main_checking AS (
  SELECT '8815abd9-a681-4c81-857c-753a9e13e23d'::uuid AS id
),
candidates AS (
  SELECT
    bt.id                 AS bank_transaction_id,
    bt.transaction_date,
    bt.amount,
    bt.payee,
    bt.description,
    bt.project_id,
    bt.bank_account_id,
    bt.category           AS category_account_id,
    coa.account_name       AS category_account_name,
    p.name                 AS project_name,
    bt.created_by
  FROM bank_transactions bt
  JOIN main_checking mc        ON mc.id = bt.bank_account_id
  LEFT JOIN projects p          ON p.id = bt.project_id
  -- Same VARCHAR-vs-UUID cast issue as Step 2's query -- see comment there.
  LEFT JOIN accounts coa        ON bt.category ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                                AND coa.id = bt.category::uuid
  WHERE bt.is_cleared = true
    AND bt.amount < 0
    AND bt.project_id IS NOT NULL
    AND bt.category IS NOT NULL
    AND coa.account_name IS NOT NULL -- category didn't resolve to a real account -- skip it, expenses.category is NOT NULL
    AND bt.linked_expense_id IS NULL
    AND bt.linked_invoice_id IS NULL
    AND bt.linked_bill_id IS NULL
    AND bt.transaction_date >= '2026-09-01'
    AND bt.transaction_date <  '2026-10-01'
),
inserted AS (
  INSERT INTO expenses (
    company_id, created_by, expense_date, amount, category, vendor,
    description, payment_method, bank_account_id, project_id, project_name,
    tax_deductible
  )
  SELECT
    (SELECT company_id FROM bank_accounts WHERE id = c.bank_account_id),
    c.created_by,
    c.transaction_date,
    ABS(c.amount),
    c.category_account_name,
    c.payee,
    c.description,
    'bank',
    c.bank_account_id,
    c.project_id,
    c.project_name,
    true
  FROM candidates c
  RETURNING id, expense_date, amount, bank_account_id, project_id
)
-- Link each newly-created expense back to its originating bank_transaction.
-- Matches on (bank_account_id, project_id, expense_date, amount), which is
-- unique enough within this single-account/single-month backfill.
UPDATE bank_transactions bt
SET linked_expense_id = i.id,
    auto_created_expense = true
FROM inserted i
WHERE bt.bank_account_id = i.bank_account_id
  AND bt.project_id      = i.project_id
  AND bt.transaction_date = i.expense_date
  AND ABS(bt.amount)     = i.amount
  AND bt.linked_expense_id IS NULL;

-- IMPORTANT: most web SQL editors (including Supabase's) open a NEW
-- connection every time you click "Run". Postgres automatically rolls back
-- any transaction still open when its connection closes -- so if BEGIN and
-- COMMIT are run as separate clicks, the COMMIT never reaches the same
-- transaction and everything above silently vanishes. That is almost
-- certainly why nothing was added last time. COMMIT must be run in the
-- SAME paste/click as BEGIN and everything above it.
COMMIT;


-- ============================================================================
-- STEP 4 -- Verify (run AFTER Step 3, as its own separate query -- read-only,
-- no transaction needed since Step 3 already committed)
-- ============================================================================
SELECT
  (SELECT COUNT(*) FROM expenses
    WHERE payment_method = 'bank'
      AND expense_date >= '2026-09-01' AND expense_date < '2026-10-01'
      AND project_id IS NOT NULL) AS new_expense_rows,
  (SELECT COUNT(*) FROM bank_transactions
    WHERE auto_created_expense = true
      AND transaction_date >= '2026-09-01' AND transaction_date < '2026-10-01'
      AND project_id IS NOT NULL) AS newly_linked_transactions;

-- These two counts should be equal, and should match the row count you saw
-- in Step 2's preview.


-- ============================================================================
-- STEP 5 (optional, run separately AFTER committing) -- spot-check a project
-- ============================================================================
-- SELECT id, name FROM projects WHERE name ILIKE '%your project name%';
-- SELECT expense_date, amount, category, vendor, project_name, auto_created_expense
--   FROM expenses e
--   LEFT JOIN bank_transactions bt ON bt.linked_expense_id = e.id
--   WHERE e.project_id = 'PASTE-PROJECT-ID-HERE'
--   ORDER BY expense_date;
