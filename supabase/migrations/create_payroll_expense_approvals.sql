
-- ═══════════════════════════════════════════════════════════════════════════════
-- Payroll Expense Approvals Table
-- Purpose: Stores AI-parsed check stub data from CPA emails, pending owner approval.
-- When approved, line items are pushed to the expenses table.
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.payroll_expense_approvals (
  id                uuid        DEFAULT gen_random_uuid() PRIMARY KEY,

  -- Employee reference (matched by AI from the stub)
  employee_id       uuid        REFERENCES public.employees(id) ON DELETE SET NULL,
  employee_name     text,           -- raw name as detected by AI (in case match fails)

  -- Pay period info
  pay_date          date,
  pay_period_start  date,
  pay_period_end    date,

  -- Dollar amounts extracted by AI from the check stub
  gross_wages       numeric(10, 2)  NOT NULL DEFAULT 0,
  federal_tax       numeric(10, 2)  NOT NULL DEFAULT 0,
  state_tax         numeric(10, 2)  NOT NULL DEFAULT 0,
  social_security   numeric(10, 2)  NOT NULL DEFAULT 0,  -- FICA
  medicare          numeric(10, 2)  NOT NULL DEFAULT 0,
  garnishments      numeric(10, 2)  NOT NULL DEFAULT 0,
  other_deductions  numeric(10, 2)  NOT NULL DEFAULT 0,
  net_pay           numeric(10, 2)  NOT NULL DEFAULT 0,

  -- Link back to the stored check stub PDF
  check_stub_id     uuid        REFERENCES public.check_stubs(id) ON DELETE SET NULL,

  -- Email metadata (for audit trail)
  source_email      text,           -- sender email address (e.g. cc@sass.tax)
  source_subject    text,           -- email subject line
  source_filename   text,           -- original PDF filename

  -- Approval workflow
  status            text        NOT NULL DEFAULT 'pending'
                                CHECK (status IN ('pending', 'approved', 'rejected')),
  approved_by       uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at       timestamptz,
  rejection_note    text,

  -- Ownership / audit
  created_by        uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

-- ── Indexes ────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_payroll_approvals_status   ON public.payroll_expense_approvals (status);
CREATE INDEX IF NOT EXISTS idx_payroll_approvals_created  ON public.payroll_expense_approvals (created_by, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payroll_approvals_employee ON public.payroll_expense_approvals (employee_id);

-- ── Auto-update updated_at ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_payroll_approvals_updated_at
  BEFORE UPDATE ON public.payroll_expense_approvals
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── Row Level Security ─────────────────────────────────────────────────────────
ALTER TABLE public.payroll_expense_approvals ENABLE ROW LEVEL SECURITY;

-- Users can only see and manage their own records
CREATE POLICY "Users manage own payroll approvals"
  ON public.payroll_expense_approvals
  FOR ALL
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

-- Service role bypass (for edge functions)
CREATE POLICY "Service role full access"
  ON public.payroll_expense_approvals
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
