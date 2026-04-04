-- ============================================================
-- RUN THESE ONE AT A TIME in a BRAND NEW blank query tab
-- Do NOT use a saved query — open a new tab with the + button
-- ============================================================

-- STEP 1: Run this alone first to confirm employees has company_id
SELECT column_name FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'employees'
ORDER BY ordinal_position;

-- ============================================================
-- STEP 2: Run these drops alone
-- ============================================================
/*
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
*/

-- ============================================================
-- STEP 3: Invoice SELECT policy (run alone)
-- ============================================================
/*
CREATE POLICY "Employees can read company invoices"
ON public.invoices FOR SELECT
USING (
  created_by = auth.uid()
  OR created_by IN (
    SELECT emp.company_id FROM public.employees emp
    WHERE emp.user_id = auth.uid() AND emp.company_id IS NOT NULL
  )
);
*/

-- ============================================================
-- STEP 4: Invoice INSERT policy (run alone)
-- ============================================================
/*
CREATE POLICY "Employees can insert company invoices"
ON public.invoices FOR INSERT
WITH CHECK (
  created_by = auth.uid()
  OR created_by IN (
    SELECT emp.company_id FROM public.employees emp
    WHERE emp.user_id = auth.uid() AND emp.company_id IS NOT NULL
  )
);
*/

-- ============================================================
-- STEP 5: Invoice UPDATE policy (run alone)
-- ============================================================
/*
CREATE POLICY "Employees can update company invoices"
ON public.invoices FOR UPDATE
USING (
  created_by = auth.uid()
  OR created_by IN (
    SELECT emp.company_id FROM public.employees emp
    WHERE emp.user_id = auth.uid() AND emp.company_id IS NOT NULL
  )
);
*/

-- ============================================================
-- STEP 6: Estimates SELECT policy (run alone)
-- ============================================================
/*
CREATE POLICY "Employees can read company estimates"
ON public.estimates FOR SELECT
USING (
  company_id = auth.uid()
  OR company_id IN (
    SELECT emp.company_id FROM public.employees emp
    WHERE emp.user_id = auth.uid() AND emp.company_id IS NOT NULL
  )
);
*/

-- ============================================================
-- STEP 7: Estimates INSERT policy (run alone)
-- ============================================================
/*
CREATE POLICY "Employees can insert company estimates"
ON public.estimates FOR INSERT
WITH CHECK (
  company_id = auth.uid()
  OR company_id IN (
    SELECT emp.company_id FROM public.employees emp
    WHERE emp.user_id = auth.uid() AND emp.company_id IS NOT NULL
  )
);
*/

-- ============================================================
-- STEP 8: Estimates UPDATE policy (run alone)
-- ============================================================
/*
CREATE POLICY "Employees can update company estimates"
ON public.estimates FOR UPDATE
USING (
  company_id = auth.uid()
  OR company_id IN (
    SELECT emp.company_id FROM public.employees emp
    WHERE emp.user_id = auth.uid() AND emp.company_id IS NOT NULL
  )
);
*/
