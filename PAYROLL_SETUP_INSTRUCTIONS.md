# 💰 Payroll System Setup Instructions

## Step 1 — Run the SQL Migration in Supabase

Go to your **Supabase Dashboard** → **SQL Editor** → paste and run this SQL:

```sql
-- Create payroll_expense_approvals table
CREATE TABLE IF NOT EXISTS public.payroll_expense_approvals (
  id                uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id       uuid        REFERENCES public.employees(id) ON DELETE SET NULL,
  employee_name     text,
  pay_date          date,
  pay_period_start  date,
  pay_period_end    date,
  gross_wages       numeric(10, 2)  NOT NULL DEFAULT 0,
  federal_tax       numeric(10, 2)  NOT NULL DEFAULT 0,
  state_tax         numeric(10, 2)  NOT NULL DEFAULT 0,
  social_security   numeric(10, 2)  NOT NULL DEFAULT 0,
  medicare          numeric(10, 2)  NOT NULL DEFAULT 0,
  garnishments      numeric(10, 2)  NOT NULL DEFAULT 0,
  other_deductions  numeric(10, 2)  NOT NULL DEFAULT 0,
  net_pay           numeric(10, 2)  NOT NULL DEFAULT 0,
  check_stub_id     uuid        REFERENCES public.check_stubs(id) ON DELETE SET NULL,
  source_email      text,
  source_subject    text,
  source_filename   text,
  status            text        NOT NULL DEFAULT 'pending'
                                CHECK (status IN ('pending', 'approved', 'rejected')),
  approved_by       uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at       timestamptz,
  rejection_note    text,
  created_by        uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payroll_approvals_status   ON public.payroll_expense_approvals (status);
CREATE INDEX IF NOT EXISTS idx_payroll_approvals_created  ON public.payroll_expense_approvals (created_by, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payroll_approvals_employee ON public.payroll_expense_approvals (employee_id);

ALTER TABLE public.payroll_expense_approvals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own payroll approvals"
  ON public.payroll_expense_approvals
  FOR ALL
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Service role full access"
  ON public.payroll_expense_approvals
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
```

---

## Step 2 — Add New Expense Categories (Optional)

Your Expenses page uses category values. The payroll approval now creates expenses with these categories:
- `labor` — Gross wages (already exists ✅)
- `payroll_tax` — Federal/State/FICA/Medicare tax (NEW)
- `garnishment` — Wage garnishments (NEW)
- `other` — Other deductions (already exists ✅)

If you have a category constraint on the `expenses` table, run this to add the new categories:

```sql
-- Remove old constraint if it exists, add new one with payroll categories
ALTER TABLE public.expenses DROP CONSTRAINT IF EXISTS expenses_category_check;
ALTER TABLE public.expenses ADD CONSTRAINT expenses_category_check 
  CHECK (category IN (
    'materials', 'labor', 'fuel', 'equipment', 'tools', 'permits', 
    'insurance', 'office', 'vehicle', 'utilities', 'marketing', 
    'subcontractor', 'other', 'payroll_tax', 'garnishment'
  ));
```

---

## Step 3 — Deploy Edge Function (if not already done)

In your terminal from the `estimator-react` directory:
```
npx supabase functions deploy process-check-stub-email
```

---

## How the System Works

1. **CPA sends** check stubs (PDF) to your Outlook (dustin@dmlelectrical.com) or directly to paystubs@dmlelectrical.com
2. **You open** the Email Inbox in TradeFlow → CPA emails are highlighted in 🟢 green with a "🧾 Payroll" badge
3. **Click** "🤖 Process All Pay Stubs with AI" — AI reads each stub, extracts all dollar amounts, saves to employee folders
4. **You see** a success message → click "Review & Approve →"
5. **On the Payroll Approval Queue page** (`/payroll-approval`), you see each stub's parsed data:
   - Gross Wages, Federal Tax, State Tax, FICA, Medicare, Garnishments, Net Pay
6. **Edit** any values if the AI misread something
7. **Click ✅ Approve** → individual expense line items are automatically created in the Expenses page
8. **Click ❌ Reject** → record is archived with an optional note

---

## CPA Email Address Configured
- Emails from: **cc@sass.tax** are auto-flagged as "🧾 Payroll" in the inbox
