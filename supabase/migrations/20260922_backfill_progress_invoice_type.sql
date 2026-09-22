-- Backfill invoice_type = 'progress' for existing progress-billing invoices.
--
-- invoices.invoice_type has existed since the initial schema (default
-- 'quick') but was never actually set by any code path — every row in
-- production was 'quick', including progress-billing invoices, which were
-- only identifiable by a substring match on the free-text `notes` column
-- ("Progress billing"). That fragile classification was also used to decide
-- what counts toward a project's contract-progress percentage.
--
-- This migration:
--   1. Backfills invoice_type='progress' on existing rows so the column
--      reflects reality going forward.
--   2. Complements the frontend change where ProgressBilling.jsx now sets
--      invoice_type: 'progress' on every new progress invoice it creates,
--      and ProjectDetail.jsx now creates invoice_type: 'deposit' invoices
--      via the new "Deposit Invoice" action — which are excluded from the
--      contract-progress % rollup because a deposit is unearned revenue,
--      not billed contract work.
--
-- No CHECK constraint exists on invoice_type (it's a plain text column with
-- a default), so no schema change is needed to introduce the 'deposit' and
-- 'progress' values — this file is a one-time data backfill only.

UPDATE invoices
SET invoice_type = 'progress'
WHERE notes LIKE '%Progress billing%'
  AND invoice_type IS DISTINCT FROM 'progress';
