-- ============================================================
-- FIX: Allow supervisors/employees to read their company's customers
-- ============================================================
-- The customers table RLS currently only allows the admin (owner) to read
-- records where company_id = auth.uid(). Supervisors have a different uid,
-- so they see nothing. This adds a policy that lets any employee read
-- customers belonging to their company.
-- ============================================================

-- Step 1: Add a SELECT policy so employees can read company customers
-- This works because employees.company_id = admin's user_id = customers.company_id
CREATE POLICY "Employees can read company customers"
ON public.customers
FOR SELECT
USING (
  -- Original owner (admin)
  company_id = auth.uid()
  OR
  -- Employees/supervisors of this company
  company_id IN (
    SELECT company_id
    FROM public.employees
    WHERE user_id = auth.uid()
      AND company_id IS NOT NULL
  )
);

-- Step 2: Also allow employees to INSERT customers for their company
-- (so supervisors can add new customers from quick estimate/invoice)
CREATE POLICY "Employees can insert company customers"
ON public.customers
FOR INSERT
WITH CHECK (
  company_id = auth.uid()
  OR
  company_id IN (
    SELECT company_id
    FROM public.employees
    WHERE user_id = auth.uid()
      AND company_id IS NOT NULL
  )
);

-- ============================================================
-- If you get "policy already exists" errors, drop the old ones first:
-- DROP POLICY IF EXISTS "Employees can read company customers" ON public.customers;
-- DROP POLICY IF EXISTS "Employees can insert company customers" ON public.customers;
-- Then re-run the CREATE statements above.
-- ============================================================
