-- ============================================================
-- FIX: Admin cannot delete invoices/estimates made on mobile
--
-- Run this in Supabase Dashboard → SQL Editor
--
-- Root cause confirmed:
--   The employees table does NOT have a company_id column.
--   All previous fix attempts using employees.company_id fail.
--
-- Correct approach:
--   Use the JWT app_metadata role claim to identify admins.
--   Any user with role = 'admin' in their JWT can delete
--   any invoice/estimate. Other users can only delete their own.
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- INVOICES: Replace DELETE policy
-- ─────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Company members can delete invoices"     ON public.invoices;
DROP POLICY IF EXISTS "Users can delete own invoices"           ON public.invoices;
DROP POLICY IF EXISTS "Supervisors can delete company invoices" ON public.invoices;

CREATE POLICY "Company members can delete invoices"
ON public.invoices FOR DELETE
TO authenticated
USING (
  created_by = auth.uid()
  OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
);

-- ─────────────────────────────────────────────────────────────
-- INVOICE ITEMS: Replace DELETE policy
-- ─────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Company members can delete invoice items"     ON public.invoice_items;
DROP POLICY IF EXISTS "Users can delete own invoice items"           ON public.invoice_items;
DROP POLICY IF EXISTS "Supervisors can delete company invoice items" ON public.invoice_items;

CREATE POLICY "Company members can delete invoice items"
ON public.invoice_items FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.invoices inv
    WHERE inv.id = invoice_items.invoice_id
      AND (
        inv.created_by = auth.uid()
        OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
      )
  )
);

-- ─────────────────────────────────────────────────────────────
-- ESTIMATES: Replace DELETE policy
-- ─────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Company members can delete estimates"     ON public.estimates;
DROP POLICY IF EXISTS "Users can delete own estimates"           ON public.estimates;
DROP POLICY IF EXISTS "Supervisors can delete company estimates" ON public.estimates;

CREATE POLICY "Company members can delete estimates"
ON public.estimates FOR DELETE
TO authenticated
USING (
  company_id = auth.uid()
  OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
);

-- ─────────────────────────────────────────────────────────────
-- ESTIMATE ITEMS: Replace DELETE policy
-- ─────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Company members can delete estimate items"     ON public.estimate_items;
DROP POLICY IF EXISTS "Users can delete own estimate items"           ON public.estimate_items;
DROP POLICY IF EXISTS "Supervisors can delete company estimate items" ON public.estimate_items;

CREATE POLICY "Company members can delete estimate items"
ON public.estimate_items FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.estimates est
    WHERE est.id = estimate_items.estimate_id
      AND (
        est.company_id = auth.uid()
        OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
      )
  )
);

-- ─────────────────────────────────────────────────────────────
-- Also fix SELECT so admin can see ALL invoices/estimates
-- (required so the web app lists them before deleting)
-- ─────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Company members can view invoices"      ON public.invoices;
DROP POLICY IF EXISTS "Users can view own invoices"            ON public.invoices;
DROP POLICY IF EXISTS "Supervisors can view company invoices"  ON public.invoices;

CREATE POLICY "Company members can view invoices"
ON public.invoices FOR SELECT
TO authenticated
USING (
  created_by = auth.uid()
  OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
);

DROP POLICY IF EXISTS "Company members can view estimates"     ON public.estimates;
DROP POLICY IF EXISTS "Users can view own estimates"           ON public.estimates;
DROP POLICY IF EXISTS "Supervisors can view company estimates" ON public.estimates;

CREATE POLICY "Company members can view estimates"
ON public.estimates FOR SELECT
TO authenticated
USING (
  company_id = auth.uid()
  OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
);

-- ─────────────────────────────────────────────────────────────
-- Also fix UPDATE so admin can update mobile-created records
-- ─────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Company members can update invoices"     ON public.invoices;
DROP POLICY IF EXISTS "Users can update own invoices"           ON public.invoices;
DROP POLICY IF EXISTS "Supervisors can update company invoices" ON public.invoices;

CREATE POLICY "Company members can update invoices"
ON public.invoices FOR UPDATE
TO authenticated
USING (
  created_by = auth.uid()
  OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
);

DROP POLICY IF EXISTS "Company members can update estimates"     ON public.estimates;
DROP POLICY IF EXISTS "Users can update own estimates"           ON public.estimates;
DROP POLICY IF EXISTS "Supervisors can update company estimates" ON public.estimates;

CREATE POLICY "Company members can update estimates"
ON public.estimates FOR UPDATE
TO authenticated
USING (
  company_id = auth.uid()
  OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
);

-- ─────────────────────────────────────────────────────────────
-- DONE — no backfill needed, no employees.company_id used
-- ─────────────────────────────────────────────────────────────
