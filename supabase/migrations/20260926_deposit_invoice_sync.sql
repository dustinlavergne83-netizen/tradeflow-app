-- Deposit invoices (invoices.invoice_type = 'deposit') and recorded deposits
-- (project_deposits rows, created via ProjectDetail's "Record Deposit"
-- button) were two completely disconnected ways of tracking the same kind
-- of money. The "Apply Deposits to Invoice" picker only ever reads from
-- project_deposits, so money taken via a Deposit Invoice (paid in full or
-- in part) was invisible to that picker forever, even once collected —
-- e.g. $3,000 across two fully-paid deposit invoices on one project with
-- zero project_deposits rows to show for it.
--
-- source_invoice_id lets a project_deposits row be identified as "synced
-- from this deposit invoice's payments" so the sync function (see
-- lib/deposits.js syncDepositInvoicePayment) can safely upsert it anytime
-- that invoice's amount_paid changes, instead of creating duplicates.
ALTER TABLE public.project_deposits
  ADD COLUMN IF NOT EXISTS source_invoice_id uuid REFERENCES public.invoices(id) ON DELETE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS idx_project_deposits_source_invoice_unique
  ON public.project_deposits(source_invoice_id)
  WHERE source_invoice_id IS NOT NULL;

SELECT 'project_deposits.source_invoice_id added' AS status;
