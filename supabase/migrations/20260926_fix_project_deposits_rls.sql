-- project_deposits previously had a single RLS policy:
--   "project_deposits_user_isolation": created_by = auth.uid()
-- This meant a deposit was only ever visible to the exact employee who
-- recorded it — every other employee at the same company (including
-- admins) got an empty result when querying project_deposits, with no
-- error, so the "Apply Deposits to Invoice" prompt silently never appeared
-- for them even when a real unapplied deposit existed for the project.
-- This is the actual root cause behind "new invoice doesn't ask to apply a
-- deposit" when the deposit was recorded by a different team member.
--
-- Replaces it with company-scoped access via the deposit's project,
-- consistent with how every other company-scoped table in this schema
-- (customers, assemblies, employees, etc.) uses get_my_company_id().

DROP POLICY IF EXISTS "project_deposits_user_isolation" ON public.project_deposits;

CREATE POLICY "project_deposits_company_select" ON public.project_deposits
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_deposits.project_id
        AND p.company_id = get_my_company_id()
    )
  );

CREATE POLICY "project_deposits_company_insert" ON public.project_deposits
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_deposits.project_id
        AND p.company_id = get_my_company_id()
    )
  );

CREATE POLICY "project_deposits_company_update" ON public.project_deposits
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_deposits.project_id
        AND p.company_id = get_my_company_id()
    )
  );

CREATE POLICY "project_deposits_company_delete" ON public.project_deposits
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_deposits.project_id
        AND p.company_id = get_my_company_id()
    )
  );

SELECT 'project_deposits RLS widened to company scope' AS status;
