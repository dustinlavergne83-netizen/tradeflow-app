-- Deposits were all-or-nothing and single-invoice: applying a deposit to one
-- invoice set status='applied' and invoice_id=<that invoice>, which
-- permanently removed it from every other invoice's "available deposits"
-- list — even when only part of the deposit's amount had actually been
-- used. A $3,665.25 deposit fully consumed by an $8,413 invoice became
-- entirely unavailable for the next progress invoice on the same project,
-- even though none of it was truly spent.
--
-- This adds a deposit_allocations join table so a single deposit can be
-- split across multiple invoices, each allocation recording how much of
-- the deposit went to that invoice. A deposit's remaining balance is
-- deposit_amount - SUM(allocations.amount), and it stays available for
-- selection as long as that remaining balance is > 0.
--
-- Existing 'applied' deposits are backfilled with a single allocation for
-- their full amount against their existing invoice_id, so historical data
-- is preserved and immediately consistent with the new model.

CREATE TABLE IF NOT EXISTS public.deposit_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deposit_id uuid NOT NULL REFERENCES public.project_deposits(id) ON DELETE CASCADE,
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  amount numeric NOT NULL CHECK (amount > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);

CREATE INDEX IF NOT EXISTS idx_deposit_allocations_deposit_id ON public.deposit_allocations(deposit_id);
CREATE INDEX IF NOT EXISTS idx_deposit_allocations_invoice_id ON public.deposit_allocations(invoice_id);

ALTER TABLE public.deposit_allocations ENABLE ROW LEVEL SECURITY;

-- Mirrors project_deposits' own (permissive, user.id-keyed) access pattern
-- rather than inventing a new one, consistent with the rest of this schema
-- era pending the broader company_id migration discussed separately.
DROP POLICY IF EXISTS "Users can view deposit allocations" ON public.deposit_allocations;
CREATE POLICY "Users can view deposit allocations" ON public.deposit_allocations
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can insert deposit allocations" ON public.deposit_allocations;
CREATE POLICY "Users can insert deposit allocations" ON public.deposit_allocations
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Users can delete deposit allocations" ON public.deposit_allocations;
CREATE POLICY "Users can delete deposit allocations" ON public.deposit_allocations
  FOR DELETE USING (true);

-- Backfill: every existing 'applied' deposit becomes one allocation for its
-- full amount against its existing invoice_id.
INSERT INTO public.deposit_allocations (deposit_id, invoice_id, amount, created_at)
SELECT pd.id, pd.invoice_id, pd.deposit_amount, COALESCE(pd.applied_date, pd.updated_at, now())
FROM public.project_deposits pd
WHERE pd.status = 'applied'
  AND pd.invoice_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.deposit_allocations da WHERE da.deposit_id = pd.id
  );

SELECT 'deposit_allocations created and backfilled' AS status;
