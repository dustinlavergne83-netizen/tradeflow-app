-- ============================================================
-- CHECK STUBS SYSTEM
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. Create check_stubs table
CREATE TABLE IF NOT EXISTS public.check_stubs (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id     uuid REFERENCES public.employees(id) ON DELETE CASCADE,
  pay_period_start date,
  pay_period_end   date,
  pay_date         date,
  file_path        text NOT NULL,
  file_name        text,
  uploaded_by      uuid, -- null = email upload
  ai_confidence    numeric(4,3) DEFAULT 0,
  ai_raw_name      text, -- what the AI found on the stub
  created_at       timestamptz DEFAULT now()
);

-- 2. Enable RLS
ALTER TABLE public.check_stubs ENABLE ROW LEVEL SECURITY;

-- 3. Admins can see all stubs for their company's employees
CREATE POLICY "admins_see_all_check_stubs"
ON public.check_stubs
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.employees e
    WHERE e.id = check_stubs.employee_id
    AND e.company_id = (
      SELECT company_id FROM public.employees
      WHERE user_id = auth.uid() LIMIT 1
    )
  )
);

-- 4. Employees can only see their own stubs
CREATE POLICY "employees_see_own_check_stubs"
ON public.check_stubs
FOR SELECT
USING (
  employee_id = (
    SELECT id FROM public.employees
    WHERE user_id = auth.uid() LIMIT 1
  )
);

-- 5. Index for fast per-employee lookups
CREATE INDEX IF NOT EXISTS idx_check_stubs_employee ON public.check_stubs (employee_id, pay_date DESC);

-- 6. Create check-stubs storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('check-stubs', 'check-stubs', false)
ON CONFLICT (id) DO NOTHING;

-- 7. Storage policy: admins can upload/read all
CREATE POLICY "admins_manage_check_stubs_storage"
ON storage.objects
FOR ALL
USING (
  bucket_id = 'check-stubs'
  AND EXISTS (
    SELECT 1 FROM public.employees
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'super_admin')
  )
);

-- 8. Employees can read their own stubs (path starts with their employee ID)
CREATE POLICY "employees_read_own_check_stubs_storage"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'check-stubs'
  AND (storage.foldername(name))[1] = (
    SELECT id::text FROM public.employees
    WHERE user_id = auth.uid() LIMIT 1
  )
);

-- 9. Service role (edge functions) can do everything
CREATE POLICY "service_role_check_stubs"
ON storage.objects
FOR ALL
USING (bucket_id = 'check-stubs')
WITH CHECK (bucket_id = 'check-stubs');
