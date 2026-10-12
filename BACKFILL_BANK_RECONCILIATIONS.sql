-- ============================================================================
-- BACKFILL: synthesize bank_reconciliations rows for reconciliations that
-- already happened before that table existed (see migration
-- 20261008_create_bank_reconciliations.sql for why it was missing).
-- ============================================================================
-- Problem: bank_transactions.is_reconciled has been flipped true by
-- BankReconciliation.jsx's handleReconcile() for months/years, but no
-- snapshot of "what was the statement balance, how many deposits/debits,
-- was it balanced" was ever stored anywhere -- bank_accounts.last_reconciled_
-- date/last_reconciled_balance only ever holds the MOST RECENT reconciliation,
-- overwritten every time. Every earlier period's reconciliation record is
-- unrecoverable except by re-deriving it from the transactions themselves.
--
-- This script re-derives one bank_reconciliations row PER BANK ACCOUNT PER
-- CALENDAR MONTH that contains at least one is_reconciled = true transaction.
-- It does NOT know the true statement_date or the true statement_ending_
-- balance the user typed in at the time (those were never saved), so it
-- uses the calculated balance for both and marks every row is_backfilled =
-- true + is_balanced = true + notes explaining the limitation, so nobody
-- later mistakes these for a verified-against-the-real-statement reconciliation.
--
-- Going forward (new reconciliations, created after migration
-- 20261008_create_bank_reconciliations.sql ships in BankReconciliation.jsx)
-- rows will have is_backfilled = false and a real statement_ending_balance
-- + difference, because the UI already collects that from the user.
--
-- Run Section 1 (audit, read-only) first. Only run Section 2 (backfill) if
-- Section 1 shows candidate months. Section 2 is wrapped in BEGIN/COMMIT --
-- run the COMMIT in the SAME paste/click as everything above it (most web
-- SQL editors open a new connection per click and silently roll back an
-- open transaction when that connection closes).
-- ============================================================================


-- ════════════════════════════════════════════════════════════
-- SECTION 1 — AUDIT (read-only, safe to run anytime)
-- ════════════════════════════════════════════════════════════

-- 1a. Which bank accounts have any reconciled transactions at all?
SELECT
  ba.id AS bank_account_id,
  ba.account_name,
  ba.bank_name,
  ba.opening_balance,
  ba.opening_date,
  ba.last_reconciled_date,
  ba.last_reconciled_balance,
  COUNT(*) FILTER (WHERE bt.is_reconciled) AS reconciled_txn_count
FROM bank_accounts ba
JOIN bank_transactions bt ON bt.bank_account_id = ba.id
GROUP BY ba.id, ba.account_name, ba.bank_name, ba.opening_balance, ba.opening_date,
         ba.last_reconciled_date, ba.last_reconciled_balance
HAVING COUNT(*) FILTER (WHERE bt.is_reconciled) > 0
ORDER BY ba.account_name;

-- 1b. Candidate months to be created — one row per (account, calendar month)
-- that has at least one reconciled transaction and does NOT already have a
-- bank_reconciliations row for that period (idempotency check).
WITH reconciled_months AS (
  SELECT
    bt.bank_account_id,
    DATE_TRUNC('month', bt.transaction_date)::date AS period_start,
    (DATE_TRUNC('month', bt.transaction_date) + INTERVAL '1 month - 1 day')::date AS period_end,
    COUNT(*) FILTER (WHERE bt.amount > 0) AS deposit_count,
    COALESCE(SUM(bt.amount) FILTER (WHERE bt.amount > 0), 0) AS deposit_total,
    COUNT(*) FILTER (WHERE bt.amount < 0) AS debit_count,
    COALESCE(SUM(ABS(bt.amount)) FILTER (WHERE bt.amount < 0), 0) AS debit_total
  FROM bank_transactions bt
  WHERE bt.is_reconciled = true
  GROUP BY bt.bank_account_id, DATE_TRUNC('month', bt.transaction_date)
)
SELECT
  rm.*,
  ba.account_name,
  ba.company_id
FROM reconciled_months rm
JOIN bank_accounts ba ON ba.id = rm.bank_account_id
WHERE NOT EXISTS (
  SELECT 1 FROM bank_reconciliations br
  WHERE br.bank_account_id = rm.bank_account_id
    AND br.period_start = rm.period_start
    AND br.period_end = rm.period_end
)
ORDER BY ba.account_name, rm.period_start;



-- ════════════════════════════════════════════════════════════
-- SECTION 2 — BACKFILL (only run if Section 1b returned rows)
-- ════════════════════════════════════════════════════════════

BEGIN;

WITH reconciled_months AS (
  SELECT
    bt.bank_account_id,
    DATE_TRUNC('month', bt.transaction_date)::date AS period_start,
    (DATE_TRUNC('month', bt.transaction_date) + INTERVAL '1 month - 1 day')::date AS period_end,
    COUNT(*) FILTER (WHERE bt.amount > 0) AS deposit_count,
    COALESCE(SUM(bt.amount) FILTER (WHERE bt.amount > 0), 0) AS deposit_total,
    COUNT(*) FILTER (WHERE bt.amount < 0) AS debit_count,
    COALESCE(SUM(ABS(bt.amount)) FILTER (WHERE bt.amount < 0), 0) AS debit_total
  FROM bank_transactions bt
  WHERE bt.is_reconciled = true
  GROUP BY bt.bank_account_id, DATE_TRUNC('month', bt.transaction_date)
),
-- Beginning balance per month = account opening_balance + sum of every
-- CLEARED transaction (reconciled or not) strictly before this month's
-- period_start. Mirrors the exact formula in BankReconciliation.jsx's
-- loadAccountData() (startingBalance), so the backfilled numbers reconcile
-- against the same math the live screen would compute today.
to_insert AS (
  SELECT
    ba.company_id,
    rm.bank_account_id,
    rm.period_start,
    rm.period_end,
    rm.period_end AS statement_date,
    COALESCE(ba.opening_balance, 0) + COALESCE((
      SELECT SUM(bt2.amount) FROM bank_transactions bt2
      WHERE bt2.bank_account_id = rm.bank_account_id
        AND bt2.is_cleared = true
        AND bt2.transaction_date < rm.period_start
    ), 0) AS beginning_balance,
    rm.deposit_count,
    rm.deposit_total,
    rm.debit_count,
    rm.debit_total
  FROM reconciled_months rm
  JOIN bank_accounts ba ON ba.id = rm.bank_account_id
  WHERE NOT EXISTS (
    SELECT 1 FROM bank_reconciliations br
    WHERE br.bank_account_id = rm.bank_account_id
      AND br.period_start = rm.period_start
      AND br.period_end = rm.period_end
  )
)
INSERT INTO bank_reconciliations (
  company_id, bank_account_id, period_start, period_end, statement_date,
  beginning_balance, statement_ending_balance, calculated_balance, difference,
  is_balanced, deposit_count, deposit_total, debit_count, debit_total,
  is_backfilled, notes
)
SELECT
  company_id,
  bank_account_id,
  period_start,
  period_end,
  statement_date,
  beginning_balance,
  -- No real statement_ending_balance was ever saved for these historical
  -- periods, so calculated and "statement" are set equal and marked
  -- is_backfilled -- see file header. difference is therefore always 0 here.
  beginning_balance + deposit_total - debit_total AS statement_ending_balance,
  beginning_balance + deposit_total - debit_total AS calculated_balance,
  0 AS difference,
  true AS is_balanced,
  deposit_count,
  deposit_total,
  debit_count,
  debit_total,
  true AS is_backfilled,
  'Synthesized by BACKFILL_BANK_RECONCILIATIONS.sql from pre-existing is_reconciled transactions. The true statement date/ending balance originally entered by the user was never stored before migration 20261008_create_bank_reconciliations.sql, so this period''s statement_ending_balance is a re-derived calculated value, not an independently verified bank statement figure.' AS notes
FROM to_insert;

-- Stamp the newly created reconciliation id back onto the transactions it
-- summarizes, filling in the long-orphaned bank_transactions.reconciliation_id
-- column for the first time.
UPDATE bank_transactions bt
SET reconciliation_id = br.id
FROM bank_reconciliations br
WHERE br.is_backfilled = true
  AND bt.bank_account_id = br.bank_account_id
  AND bt.is_reconciled = true
  AND bt.transaction_date >= br.period_start
  AND bt.transaction_date <= br.period_end
  AND bt.reconciliation_id IS NULL;

COMMIT;



-- ════════════════════════════════════════════════════════════
-- SECTION 3 — VERIFY (run AFTER Section 2, as its own query)
-- ════════════════════════════════════════════════════════════
SELECT
  ba.account_name,
  br.period_start,
  br.period_end,
  br.beginning_balance,
  br.statement_ending_balance,
  br.deposit_count,
  br.deposit_total,
  br.debit_count,
  br.debit_total,
  br.is_backfilled,
  (SELECT COUNT(*) FROM bank_transactions bt WHERE bt.reconciliation_id = br.id) AS linked_txn_count
FROM bank_reconciliations br
JOIN bank_accounts ba ON ba.id = br.bank_account_id
WHERE br.is_backfilled = true
ORDER BY ba.account_name, br.period_start;

-- linked_txn_count should equal deposit_count + debit_count for every row.

