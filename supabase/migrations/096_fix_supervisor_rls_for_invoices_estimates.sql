-- ============================================================
-- Migration 096: Fix RLS so supervisors can create invoices,
-- estimates, and customers for their company.
--
-- Root cause: Original policies only allow auth.uid() = created_by
-- (or company_id). Supervisors set created_by = their admin's uid
-- (fetched from employees.company_id), so the check fails.
-- ============================================================

-- Helper: get the company_id (admin's uid) for the current user.
-- For the admin themselves, returns their own uid.
-- Uses SECURITY DEFINER to bypass RLS on employees table.
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
  -- If found in employees, return company_id; otherwise user IS the admin
  RETURN COALESCE(cid, auth.uid());
END;
$$;

-- ─────────────────────────────────────────────────────────────
-- INVOICES
-- ─────────────────────────────────────────────────────────────

-- Drop old supervisor-attempt policies (if any from earlier manual runs)
DROP POLICY IF EXISTS "Employees can read company invoices"   ON public.invoices;
DROP POLICY IF EXISTS "Employees can insert company invoices" ON public.invoices;
DROP POLICY IF EXISTS "Employees can update company invoices" ON public.invoices;
DROP POLICY IF EXISTS "Supervisors can view company invoices"   ON public.invoices;
DROP POLICY IF EXISTS "Supervisors can insert company invoices" ON public.invoices;
DROP POLICY IF EXISTS "Supervisors can update company invoices" ON public.invoices;

-- SELECT: user sees their own invoices OR invoices belonging to their company
CREATE POLICY "Supervisors can view company invoices"
ON public.invoices FOR SELECT
TO authenticated
USING (
  created_by = auth.uid()
  OR created_by = get_my_company_id()
);

-- INSERT: user can insert when created_by is their own uid OR their company's admin uid
CREATE POLICY "Supervisors can insert company invoices"
ON public.invoices FOR INSERT
TO authenticated
WITH CHECK (
  created_by = auth.uid()
  OR created_by = get_my_company_id()
);

-- UPDATE: user can update their own or company invoices
CREATE POLICY "Supervisors can update company invoices"
ON public.invoices FOR UPDATE
TO authenticated
USING (
  created_by = auth.uid()
  OR created_by = get_my_company_id()
);

-- ─────────────────────────────────────────────────────────────
-- INVOICE ITEMS
-- ─────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Employees can insert invoice items"          ON public.invoice_items;
DROP POLICY IF EXISTS "Authenticated users can insert invoice items" ON public.invoice_items;
DROP POLICY IF EXISTS "Supervisors can view company invoice items"   ON public.invoice_items;
DROP POLICY IF EXISTS "Supervisors can insert company invoice items" ON public.invoice_items;
DROP POLICY IF EXISTS "Supervisors can update company invoice items" ON public.invoice_items;

-- SELECT
CREATE POLICY "Supervisors can view company invoice items"
ON public.invoice_items FOR SELECT
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.invoices
  WHERE invoices.id = invoice_items.invoice_id
    AND (invoices.created_by = auth.uid() OR invoices.created_by = get_my_company_id())
));

-- INSERT
CREATE POLICY "Supervisors can insert company invoice items"
ON public.invoice_items FOR INSERT
TO authenticated
WITH CHECK (EXISTS (
  SELECT 1 FROM public.invoices
  WHERE invoices.id = invoice_items.invoice_id
    AND (invoices.created_by = auth.uid() OR invoices.created_by = get_my_company_id())
));

-- UPDATE
CREATE POLICY "Supervisors can update company invoice items"
ON public.invoice_items FOR UPDATE
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.invoices
  WHERE invoices.id = invoice_items.invoice_id
    AND (invoices.created_by = auth.uid() OR invoices.created_by = get_my_company_id())
));

-- ─────────────────────────────────────────────────────────────
-- ESTIMATES
-- ─────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Employees can read company estimates"   ON public.estimates;
DROP POLICY IF EXISTS "Employees can insert company estimates" ON public.estimates;
DROP POLICY IF EXISTS "Employees can update company estimates" ON public.estimates;
DROP POLICY IF EXISTS "Supervisors can view company estimates"   ON public.estimates;
DROP POLICY IF EXISTS "Supervisors can insert company estimates" ON public.estimates;
DROP POLICY IF EXISTS "Supervisors can update company estimates" ON public.estimates;

-- SELECT
CREATE POLICY "Supervisors can view company estimates"
ON public.estimates FOR SELECT
TO authenticated
USING (
  company_id = auth.uid()
  OR company_id = get_my_company_id()
);

-- INSERT: supervisor sets company_id = admin's uid, which equals get_my_company_id()
CREATE POLICY "Supervisors can insert company estimates"
ON public.estimates FOR INSERT
TO authenticated
WITH CHECK (
  company_id = auth.uid()
  OR company_id = get_my_company_id()
);

-- UPDATE
CREATE POLICY "Supervisors can update company estimates"
ON public.estimates FOR UPDATE
TO authenticated
USING (
  company_id = auth.uid()
  OR company_id = get_my_company_id()
);

-- ─────────────────────────────────────────────────────────────
-- ESTIMATE ITEMS
-- ─────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Employees can insert estimate items"          ON public.estimate_items;
DROP POLICY IF EXISTS "Authenticated users can insert estimate items" ON public.estimate_items;
DROP POLICY IF EXISTS "Supervisors can view company estimate items"   ON public.estimate_items;
DROP POLICY IF EXISTS "Supervisors can insert company estimate items" ON public.estimate_items;
DROP POLICY IF EXISTS "Supervisors can update company estimate items" ON public.estimate_items;

-- SELECT
CREATE POLICY "Supervisors can view company estimate items"
ON public.estimate_items FOR SELECT
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.estimates
  WHERE estimates.id = estimate_items.estimate_id
    AND (estimates.company_id = auth.uid() OR estimates.company_id = get_my_company_id())
));

-- INSERT
CREATE POLICY "Supervisors can insert company estimate items"
ON public.estimate_items FOR INSERT
TO authenticated
WITH CHECK (EXISTS (
  SELECT 1 FROM public.estimates
  WHERE estimates.id = estimate_items.estimate_id
    AND (estimates.company_id = auth.uid() OR estimates.company_id = get_my_company_id())
));

-- UPDATE
CREATE POLICY "Supervisors can update company estimate items"
ON public.estimate_items FOR UPDATE
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.estimates
  WHERE estimates.id = estimate_items.estimate_id
    AND (estimates.company_id = auth.uid() OR estimates.company_id = get_my_company_id())
));

-- ─────────────────────────────────────────────────────────────
-- CUSTOMERS
-- ─────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Employees can read company customers"   ON public.customers;
DROP POLICY IF EXISTS "Employees can insert company customers" ON public.customers;
DROP POLICY IF EXISTS "Supervisors can view company customers"   ON public.customers;
DROP POLICY IF EXISTS "Supervisors can insert company customers" ON public.customers;

-- SELECT
CREATE POLICY "Supervisors can view company customers"
ON public.customers FOR SELECT
TO authenticated
USING (
  company_id = auth.uid()
  OR company_id = get_my_company_id()
);

-- INSERT: supervisor inserts customer with company_id = get_my_company_id()
CREATE POLICY "Supervisors can insert company customers"
ON public.customers FOR INSERT
TO authenticated
WITH CHECK (
  company_id = auth.uid()
  OR company_id = get_my_company_id()
);
