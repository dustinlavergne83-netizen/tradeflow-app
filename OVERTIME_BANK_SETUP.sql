-- ============================================================
-- OVERTIME BANK SYSTEM
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. Add ot_bank_enabled flag to projects table
ALTER TABLE public.projects
ADD COLUMN IF NOT EXISTS ot_bank_enabled boolean DEFAULT false;

-- 2. Create overtime_bank table
--    Tracks OT hours banked per employee per week per project
CREATE TABLE IF NOT EXISTS public.overtime_bank (
  id               uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id      uuid REFERENCES public.employees(id) ON DELETE CASCADE,
  project_id       uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  week_start       date NOT NULL,
  week_end         date NOT NULL,
  total_hours      numeric(6,2) NOT NULL,   -- actual hours worked
  regular_hours    numeric(6,2) NOT NULL DEFAULT 40, -- hours paid during the week
  banked_hours     numeric(6,2) NOT NULL,   -- total_hours - regular_hours
  hourly_rate      numeric(8,2),            -- employee rate at time of banking
  banked_ot_value  numeric(10,2),           -- banked_hours * hourly_rate * 1.5
  notes            text,
  created_by       uuid,
  created_at       timestamptz DEFAULT now()
);

-- 3. Create overtime_payouts table
--    Tracks when banked OT is paid out as a bonus
CREATE TABLE IF NOT EXISTS public.overtime_payouts (
  id               uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id      uuid REFERENCES public.employees(id) ON DELETE CASCADE,
  project_id       uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  payout_date      date NOT NULL,
  hours_paid_out   numeric(6,2) NOT NULL,
  hourly_rate      numeric(8,2) NOT NULL,   -- rate used for payout (1.5x already applied)
  ot_rate          numeric(8,2) NOT NULL,   -- hourly_rate * 1.5
  amount           numeric(10,2) NOT NULL,  -- hours_paid_out * ot_rate
  notes            text,
  created_by       uuid,
  created_at       timestamptz DEFAULT now()
);

-- 4. Enable RLS on both tables
ALTER TABLE public.overtime_bank ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.overtime_payouts ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policy — admins can manage all OT bank records for their company
CREATE POLICY "admins_manage_overtime_bank"
ON public.overtime_bank
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.employees e
    WHERE e.user_id = auth.uid()
    AND e.role IN ('admin', 'super_admin')
  )
);

CREATE POLICY "admins_manage_overtime_payouts"
ON public.overtime_payouts
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.employees e
    WHERE e.user_id = auth.uid()
    AND e.role IN ('admin', 'super_admin')
  )
);

-- 6. Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_ot_bank_employee ON public.overtime_bank (employee_id, week_start DESC);
CREATE INDEX IF NOT EXISTS idx_ot_bank_project ON public.overtime_bank (project_id);
CREATE INDEX IF NOT EXISTS idx_ot_payouts_employee ON public.overtime_payouts (employee_id, payout_date DESC);
CREATE INDEX IF NOT EXISTS idx_ot_payouts_project ON public.overtime_payouts (project_id);

-- ============================================================
-- VERIFICATION QUERIES (run to confirm setup)
-- ============================================================
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'projects' AND column_name = 'ot_bank_enabled';
-- SELECT COUNT(*) FROM public.overtime_bank;
-- SELECT COUNT(*) FROM public.overtime_payouts;
