-- ============================================================
-- OT BANK ENROLLMENT SYSTEM
-- Tracks which employees are enrolled in OT banking per project
-- Run this in Supabase SQL Editor
-- ============================================================

-- Create the ot_bank_enrollments table
CREATE TABLE IF NOT EXISTS public.ot_bank_enrollments (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id   uuid NOT NULL,
  project_id   uuid REFERENCES public.projects(id) ON DELETE CASCADE,
  employee_id  uuid NOT NULL,  -- references employees.user_id
  enrolled_at  timestamptz DEFAULT now(),

  -- Prevent duplicate enrollments
  UNIQUE (project_id, employee_id)
);

-- Enable RLS
ALTER TABLE public.ot_bank_enrollments ENABLE ROW LEVEL SECURITY;

-- RLS Policy — admins can manage enrollments for their company
CREATE POLICY "admins_manage_ot_enrollments"
ON public.ot_bank_enrollments
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.employees e
    WHERE e.user_id = auth.uid()
    AND e.role IN ('admin', 'super_admin')
  )
);

-- Employees can read their own enrollments (so mobile app can check)
CREATE POLICY "employees_view_own_enrollments"
ON public.ot_bank_enrollments
FOR SELECT
USING (employee_id = auth.uid());

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ot_enrollments_project ON public.ot_bank_enrollments (project_id);
CREATE INDEX IF NOT EXISTS idx_ot_enrollments_employee ON public.ot_bank_enrollments (employee_id);
CREATE INDEX IF NOT EXISTS idx_ot_enrollments_company ON public.ot_bank_enrollments (company_id);

-- ============================================================
-- VERIFICATION
-- ============================================================
-- SELECT * FROM public.ot_bank_enrollments;
