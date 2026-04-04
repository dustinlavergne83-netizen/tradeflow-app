-- ============================================================
-- FIX: Supervisor/employee access to invoices & estimates
-- The employees table has NO company_id column.
-- Strategy: check if auth.uid() exists in employees table at all.
-- ============================================================

-- Drop all old attempts
DROP POLICY IF EXISTS "Employees can read company invoices" ON public.invoices;
DROP POLICY IF EXISTS "Employees can insert company invoices" ON public.invoices;
DROP POLICY IF EXISTS "Employees can update company invoices" ON public.invoices;
DROP POLICY IF EXISTS "Employees can read company estimates" ON public.estimates;
DROP POLICY IF EXISTS "Employees can insert company estimates" ON public.estimates;
DROP POLICY IF EXISTS "Employees can update company estimates" ON public.estimates;
DROP POLICY IF EXISTS "Employees can insert invoice items" ON public.invoice_items;
DROP POLICY IF EXISTS "Employees can insert estimate items" ON public.estimate_items;
DROP POLICY IF EXISTS "Authenticated users can insert invoice items" ON public.invoice_items;
DROP POLICY IF EXISTS "Authenticated users can insert estimate items" ON public.estimate_items;

-- ─── INVOICES (created_by) ────────────────────────────────────
-- SELECT: admin sees own; admin also sees employee-created; employees see all
CREATE POLICY "Employees can read company invoices"
ON public.invoices FOR SELECT
USING (
  created_by = auth.uid()
  OR created_by IN (SELECT user_id FROM public.employees)
  OR EXISTS (SELECT 1 FROM public.employees WHERE user_id = auth.uid())
);

-- INSERT: anyone can insert with their own uid as created_by
CREATE POLICY "Employees can insert company invoices"
ON public.invoices FOR INSERT
WITH CHECK (created_by = auth.uid());

-- UPDATE: creator or any employee can update
CREATE POLICY "Employees can update company invoices"
ON public.invoices FOR UPDATE
USING (
  created_by = auth.uid()
  OR EXISTS (SELECT 1 FROM public.employees WHERE user_id = auth.uid())
);

-- ─── ESTIMATES (company_id) ───────────────────────────────────
-- SELECT: admin sees own; admin also sees employee-created; employees see all
CREATE POLICY "Employees can read company estimates"
ON public.estimates FOR SELECT
USING (
  company_id = auth.uid()
  OR company_id IN (SELECT user_id FROM public.employees)
  OR EXISTS (SELECT 1 FROM public.employees WHERE user_id = auth.uid())
);

-- INSERT: admin or any employee can insert
CREATE POLICY "Employees can insert company estimates"
ON public.estimates FOR INSERT
WITH CHECK (
  company_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.employees WHERE user_id = auth.uid())
);

-- UPDATE: creator or any employee can update
CREATE POLICY "Employees can update company estimates"
ON public.estimates FOR UPDATE
USING (
  company_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.employees WHERE user_id = auth.uid())
);
