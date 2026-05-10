-- FIX_COMMUNICATIONS_RLS.sql
-- Run this in Supabase SQL Editor to fix the communications table RLS
-- (Run this if CREATE_COMMUNICATIONS_TABLE.sql errored on the policy)

-- Drop the broken policy if it exists
DROP POLICY IF EXISTS "Company members can view their communications" ON public.communications;
DROP POLICY IF EXISTS "Service role full access" ON public.communications;

-- Recreate both policies correctly
CREATE POLICY "Service role full access" ON public.communications
  FOR ALL USING (true)
  WITH CHECK (true);

CREATE POLICY "Company members can view their communications" ON public.communications
  FOR SELECT USING (
    company_id IN (
      SELECT company_id FROM public.employees WHERE user_id = auth.uid()
    )
  );

-- Make sure grants are set
GRANT ALL ON public.communications TO service_role;
GRANT SELECT ON public.communications TO authenticated;

SELECT 'Communications table RLS fixed!' as status;
