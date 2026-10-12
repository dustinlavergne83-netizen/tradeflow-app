-- ============================================================
-- Create bank_reconciliations — the table migration 026 promised
-- ("Will link to reconciliations table in Phase 4") but never
-- built. bank_transactions.reconciliation_id has existed as an
-- orphaned, unreferenced UUID column ever since.
--
-- Without this table, BankReconciliation.jsx's handleReconcile()
-- only flips is_reconciled/is_cleared on the transactions and
-- overwrites bank_accounts.last_reconciled_date/last_reconciled_
-- balance — so every prior reconciliation's statement date,
-- statement balance, and pass/fail state is destroyed the next
-- time the account is reconciled. There is currently no way to
-- answer "was March reconciled, and against what balance?" once
-- April has been reconciled.
--
-- This migration adds the snapshot table (one immutable row per
-- completed reconciliation) and wires bank_transactions.
-- reconciliation_id to it with a real FK. A companion backfill
-- script (BACKFILL_BANK_RECONCILIATIONS.sql) synthesizes rows for
-- reconciliations that already happened before this table existed.
-- ============================================================

CREATE TABLE IF NOT EXISTS bank_reconciliations (
    id                       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id               UUID NOT NULL,
    bank_account_id          UUID NOT NULL REFERENCES bank_accounts(id) ON DELETE CASCADE,

    period_start             DATE NOT NULL,
    period_end               DATE NOT NULL,
    statement_date           DATE NOT NULL,

    beginning_balance        DECIMAL(15, 2) NOT NULL DEFAULT 0,
    statement_ending_balance DECIMAL(15, 2) NOT NULL,
    calculated_balance       DECIMAL(15, 2) NOT NULL,
    difference               DECIMAL(15, 2) NOT NULL DEFAULT 0,
    is_balanced              BOOLEAN NOT NULL DEFAULT false,

    deposit_count            INTEGER NOT NULL DEFAULT 0,
    deposit_total            DECIMAL(15, 2) NOT NULL DEFAULT 0,
    debit_count              INTEGER NOT NULL DEFAULT 0,
    debit_total              DECIMAL(15, 2) NOT NULL DEFAULT 0,

    -- true for rows synthesized by BACKFILL_BANK_RECONCILIATIONS.sql
    -- from pre-existing is_reconciled transactions rather than
    -- produced live by BankReconciliation.jsx's handleReconcile().
    is_backfilled             BOOLEAN NOT NULL DEFAULT false,
    notes                     TEXT,

    reconciled_at             TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    reconciled_by             UUID REFERENCES auth.users(id),
    created_at                TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- One reconciliation per account per statement period — re-reconciling
-- the same period should update the existing row, not fork a duplicate.
CREATE UNIQUE INDEX IF NOT EXISTS idx_bank_reconciliations_account_period
    ON bank_reconciliations(bank_account_id, period_start, period_end);

CREATE INDEX IF NOT EXISTS idx_bank_reconciliations_company_id ON bank_reconciliations(company_id);
CREATE INDEX IF NOT EXISTS idx_bank_reconciliations_account_id ON bank_reconciliations(bank_account_id);
CREATE INDEX IF NOT EXISTS idx_bank_reconciliations_period_end ON bank_reconciliations(period_end);

ALTER TABLE bank_reconciliations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their company's bank reconciliations"
    ON bank_reconciliations FOR SELECT
    USING (company_id = get_my_company_id());

CREATE POLICY "Users can create bank reconciliations for their company"
    ON bank_reconciliations FOR INSERT
    WITH CHECK (company_id = get_my_company_id());

CREATE POLICY "Users can update their company's bank reconciliations"
    ON bank_reconciliations FOR UPDATE
    USING (company_id = get_my_company_id())
    WITH CHECK (company_id = get_my_company_id());

CREATE POLICY "Users can delete their company's bank reconciliations"
    ON bank_reconciliations FOR DELETE
    USING (company_id = get_my_company_id());

-- Finally wire up the column migration 026 left dangling.
ALTER TABLE bank_transactions
    DROP CONSTRAINT IF EXISTS bank_transactions_reconciliation_id_fkey;
ALTER TABLE bank_transactions
    ADD CONSTRAINT bank_transactions_reconciliation_id_fkey
    FOREIGN KEY (reconciliation_id) REFERENCES bank_reconciliations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_bank_transactions_reconciliation_id ON bank_transactions(reconciliation_id);

COMMENT ON TABLE bank_reconciliations IS 'Immutable snapshot of each completed bank reconciliation: statement balance, calculated balance, deposit/debit counts+totals at the moment reconciliation was confirmed. Long promised by migration 026, built here.';
COMMENT ON COLUMN bank_reconciliations.is_backfilled IS 'true for rows synthesized from pre-existing is_reconciled transactions by BACKFILL_BANK_RECONCILIATIONS.sql, rather than produced live by the Bank Reconciliation screen.';
