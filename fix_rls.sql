DROP POLICY IF EXISTS "Users manage own payroll approvals" ON public.payroll_expense_approvals;
CREATE POLICY "Authenticated users manage payroll approvals"
  ON public.payroll_expense_approvals
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
