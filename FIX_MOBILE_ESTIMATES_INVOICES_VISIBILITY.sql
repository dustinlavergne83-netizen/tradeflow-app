-- ============================================================
-- FIX: Mobile estimates/invoices not appearing on web app
-- 
-- Run this in Supabase Dashboard → SQL Editor
--
-- Root causes fixed:
--   1. RLS INSERT policies blocked supervisors from saving with
--      company_id/created_by = admin's UID
--   2. RLS SELECT policies prevented admin from seeing records
--      created by supervisors
--   3. Without correct SELECT access, the mobile "find max number"
--      logic picked duplicate numbers
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- STEP 1: Helper function
-- Returns the company's admin UID for any user:
--   - For admin/owner (not in employees): returns their own UID
--   - For supervisor/employee: returns their company_id from employees
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_my_company_id()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cid UUID;
BEGIN
  SELECT company_id INTO cid
  FROM employees
  WHERE user_id = auth.uid()
  LIMIT 1;
  RETURN COALESCE(cid, auth.uid());
END;
$$;

-- ─────────────────────────────────────────────────────────────
-- STEP 2: INVOICES policies
-- ─────────────────────────────────────────────────────────────

-- Drop ALL existing invoice policies to avoid conflicts
DROP POLICY IF EXISTS "Users can view own invoices"                  ON public.invoices;
DROP POLICY IF EXISTS "Users can insert own invoices"                ON public.invoices;
DROP POLICY IF EXISTS "Users can update own invoices"                ON public.invoices;
DROP POLICY IF EXISTS "Users can delete own invoices"                ON public.invoices;
DROP POLICY IF EXISTS "Employees can read company invoices"          ON public.invoices;
DROP POLICY IF EXISTS "Employees can insert company invoices"        ON public.invoices;
DROP POLICY IF EXISTS "Employees can update company invoices"        ON public.invoices;
DROP POLICY IF EXISTS "Supervisors can view company invoices"        ON public.invoices;
DROP POLICY IF EXISTS "Supervisors can insert company invoices"      ON public.invoices;
DROP POLICY IF EXISTS "Supervisors can update company invoices"      ON public.invoices;
DROP POLICY IF EXISTS "Authenticated users can view invoices"        ON public.invoices;
DROP POLICY IF EXISTS "Authenticated users can insert invoices"      ON public.invoices;
DROP POLICY IF EXISTS "Authenticated users can update invoices"      ON public.invoices;

-- SELECT: admin sees their own; supervisor/employee sees their company's
CREATE POLICY "Company members can view invoices"
ON public.invoices FOR SELECT
TO authenticated
USING (
  created_by = get_my_company_id()
);

-- INSERT: admin creates with created_by = their UID;
--         supervisor creates with created_by = admin UID (= get_my_company_id())
CREATE POLICY "Company members can insert invoices"
ON public.invoices FOR INSERT
TO authenticated
WITH CHECK (
  created_by = auth.uid()
  OR created_by = get_my_company_id()
);

-- UPDATE: same scope
CREATE POLICY "Company members can update invoices"
ON public.invoices FOR UPDATE
TO authenticated
USING (
  created_by = get_my_company_id()
);

-- DELETE: same scope
CREATE POLICY "Company members can delete invoices"
ON public.invoices FOR DELETE
TO authenticated
USING (
  created_by = get_my_company_id()
);

-- ─────────────────────────────────────────────────────────────
-- STEP 3: INVOICE ITEMS policies
-- ─────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Users can view own invoice items"             ON public.invoice_items;
DROP POLICY IF EXISTS "Users can insert own invoice items"           ON public.invoice_items;
DROP POLICY IF EXISTS "Users can update own invoice items"           ON public.invoice_items;
DROP POLICY IF EXISTS "Users can delete own invoice items"           ON public.invoice_items;
DROP POLICY IF EXISTS "Employees can insert invoice items"           ON public.invoice_items;
DROP POLICY IF EXISTS "Authenticated users can insert invoice items" ON public.invoice_items;
DROP POLICY IF EXISTS "Supervisors can view company invoice items"   ON public.invoice_items;
DROP POLICY IF EXISTS "Supervisors can insert company invoice items" ON public.invoice_items;
DROP POLICY IF EXISTS "Supervisors can update company invoice items" ON public.invoice_items;

CREATE POLICY "Company members can view invoice items"
ON public.invoice_items FOR SELECT
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.invoices
  WHERE invoices.id = invoice_items.invoice_id
    AND invoices.created_by = get_my_company_id()
));

CREATE POLICY "Company members can insert invoice items"
ON public.invoice_items FOR INSERT
TO authenticated
WITH CHECK (EXISTS (
  SELECT 1 FROM public.invoices
  WHERE invoices.id = invoice_items.invoice_id
    AND (invoices.created_by = auth.uid() OR invoices.created_by = get_my_company_id())
));

CREATE POLICY "Company members can update invoice items"
ON public.invoice_items FOR UPDATE
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.invoices
  WHERE invoices.id = invoice_items.invoice_id
    AND invoices.created_by = get_my_company_id()
));

CREATE POLICY "Company members can delete invoice items"
ON public.invoice_items FOR DELETE
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.invoices
  WHERE invoices.id = invoice_items.invoice_id
    AND invoices.created_by = get_my_company_id()
));

-- ─────────────────────────────────────────────────────────────
-- STEP 4: ESTIMATES policies
-- ─────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Users can view own estimates"                 ON public.estimates;
DROP POLICY IF EXISTS "Users can insert own estimates"               ON public.estimates;
DROP POLICY IF EXISTS "Users can update own estimates"               ON public.estimates;
DROP POLICY IF EXISTS "Users can delete own estimates"               ON public.estimates;
DROP POLICY IF EXISTS "Employees can read company estimates"         ON public.estimates;
DROP POLICY IF EXISTS "Employees can insert company estimates"       ON public.estimates;
DROP POLICY IF EXISTS "Employees can update company estimates"       ON public.estimates;
DROP POLICY IF EXISTS "Supervisors can view company estimates"       ON public.estimates;
DROP POLICY IF EXISTS "Supervisors can insert company estimates"     ON public.estimates;
DROP POLICY IF EXISTS "Supervisors can update company estimates"     ON public.estimates;
DROP POLICY IF EXISTS "Authenticated users can view estimates"       ON public.estimates;
DROP POLICY IF EXISTS "Authenticated users can insert estimates"     ON public.estimates;
DROP POLICY IF EXISTS "Authenticated users can update estimates"     ON public.estimates;

-- SELECT: anyone in the company sees all company estimates
-- This also ensures mobile numbering query returns all records → no duplicates
CREATE POLICY "Company members can view estimates"
ON public.estimates FOR SELECT
TO authenticated
USING (
  company_id = get_my_company_id()
);

-- INSERT: admin uses own UID; supervisor uses admin UID (= get_my_company_id())
CREATE POLICY "Company members can insert estimates"
ON public.estimates FOR INSERT
TO authenticated
WITH CHECK (
  company_id = auth.uid()
  OR company_id = get_my_company_id()
);

CREATE POLICY "Company members can update estimates"
ON public.estimates FOR UPDATE
TO authenticated
USING (
  company_id = get_my_company_id()
);

CREATE POLICY "Company members can delete estimates"
ON public.estimates FOR DELETE
TO authenticated
USING (
  company_id = get_my_company_id()
);

-- ─────────────────────────────────────────────────────────────
-- STEP 5: ESTIMATE ITEMS policies
-- ─────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Users can view own estimate items"            ON public.estimate_items;
DROP POLICY IF EXISTS "Users can insert own estimate items"          ON public.estimate_items;
DROP POLICY IF EXISTS "Users can update own estimate items"          ON public.estimate_items;
DROP POLICY IF EXISTS "Users can delete own estimate items"          ON public.estimate_items;
DROP POLICY IF EXISTS "Employees can insert estimate items"          ON public.estimate_items;
DROP POLICY IF EXISTS "Authenticated users can insert estimate items" ON public.estimate_items;
DROP POLICY IF EXISTS "Supervisors can view company estimate items"  ON public.estimate_items;
DROP POLICY IF EXISTS "Supervisors can insert company estimate items" ON public.estimate_items;
DROP POLICY IF EXISTS "Supervisors can update company estimate items" ON public.estimate_items;

CREATE POLICY "Company members can view estimate items"
ON public.estimate_items FOR SELECT
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.estimates
  WHERE estimates.id = estimate_items.estimate_id
    AND estimates.company_id = get_my_company_id()
));

CREATE POLICY "Company members can insert estimate items"
ON public.estimate_items FOR INSERT
TO authenticated
WITH CHECK (EXISTS (
  SELECT 1 FROM public.estimates
  WHERE estimates.id = estimate_items.estimate_id
    AND (estimates.company_id = auth.uid() OR estimates.company_id = get_my_company_id())
));

CREATE POLICY "Company members can update estimate items"
ON public.estimate_items FOR UPDATE
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.estimates
  WHERE estimates.id = estimate_items.estimate_id
    AND estimates.company_id = get_my_company_id()
));

CREATE POLICY "Company members can delete estimate items"
ON public.estimate_items FOR DELETE
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.estimates
  WHERE estimates.id = estimate_items.estimate_id
    AND estimates.company_id = get_my_company_id()
));

-- ─────────────────────────────────────────────────────────────
-- STEP 6: CUSTOMERS policies
-- ─────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Users can view own customers"                 ON public.customers;
DROP POLICY IF EXISTS "Users can insert own customers"               ON public.customers;
DROP POLICY IF EXISTS "Users can update own customers"               ON public.customers;
DROP POLICY IF EXISTS "Employees can read company customers"         ON public.customers;
DROP POLICY IF EXISTS "Employees can insert company customers"       ON public.customers;
DROP POLICY IF EXISTS "Supervisors can view company customers"       ON public.customers;
DROP POLICY IF EXISTS "Supervisors can insert company customers"     ON public.customers;

CREATE POLICY "Company members can view customers"
ON public.customers FOR SELECT
TO authenticated
USING (
  company_id = get_my_company_id()
);

CREATE POLICY "Company members can insert customers"
ON public.customers FOR INSERT
TO authenticated
WITH CHECK (
  company_id = auth.uid()
  OR company_id = get_my_company_id()
);

CREATE POLICY "Company members can update customers"
ON public.customers FOR UPDATE
TO authenticated
USING (
  company_id = get_my_company_id()
);

-- ─────────────────────────────────────────────────────────────
-- STEP 7: Backfill any supervisor-created records that were
-- accidentally saved with the supervisor's UID instead of the
-- admin's UID. This corrects any orphaned records.
-- 
-- HOW IT WORKS: For each supervisor (employee with company_id set),
-- we reassign their orphaned estimates/invoices to the admin's UID.
-- ─────────────────────────────────────────────────────────────

-- Fix orphaned estimates: if an estimate's company_id matches a
-- supervisor's user_id, reassign it to that supervisor's company_id
UPDATE public.estimates e
SET company_id = emp.company_id
FROM public.employees emp
WHERE e.company_id = emp.user_id
  AND emp.company_id IS NOT NULL
  AND emp.company_id != emp.user_id;

-- Fix orphaned invoices similarly
UPDATE public.invoices i
SET created_by = emp.company_id
FROM public.employees emp
WHERE i.created_by = emp.user_id
  AND emp.company_id IS NOT NULL
  AND emp.company_id != emp.user_id;

-- ─────────────────────────────────────────────────────────────
-- DONE! 
-- After running this, mobile-created estimates and invoices will:
--   1. Save successfully (INSERT policies allow supervisor's company UID)
--   2. Appear on the web app (SELECT policies return all company records)
--   3. Use correct sequential numbers (mobile can see all existing numbers)
-- ─────────────────────────────────────────────────────────────
