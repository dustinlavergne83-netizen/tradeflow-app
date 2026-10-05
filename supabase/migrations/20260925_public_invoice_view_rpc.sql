-- Public invoice view RPC
--
-- Problem: the emailed "View Invoice" link (/invoice/view?invoiceId=... and
-- /invoice/receipt?invoiceId=...) is opened by anonymous customers with no
-- Supabase session. The `invoices` table's RLS policies only allow SELECT
-- for (a) signed-in company members (`company_id = get_my_company_id()`) or
-- (b) a signed-in customer whose JWT email matches a `customers` row. An
-- anonymous visitor matches neither, so `.from('invoices').select('*')`
-- silently returns zero rows and the page shows "Invoice not found" even
-- though the invoice exists.
--
-- `invoice_items` already has a `qual: true` public SELECT policy, so line
-- items were always visible — only the parent invoice was blocked.
--
-- Fix: mirror the existing `get_company_branding_for_invoice` pattern (a
-- SECURITY DEFINER function granted to `anon`) instead of loosening the
-- table's RLS policy directly. This keeps the authenticated company-portal
-- queries (Invoice.jsx, ProjectDetail.jsx, etc.) going through RLS as
-- before, while giving the public view page a narrow, read-only, UUID-gated
-- window into just the columns a customer needs to see. Internal/financial
-- columns (created_by, markup percentages, processing fees, deposit/bank
-- details, payment processor IDs, source document links) are intentionally
-- excluded.

DROP FUNCTION IF EXISTS public.get_invoice_for_public_view(uuid);

CREATE OR REPLACE FUNCTION public.get_invoice_for_public_view(p_invoice_id uuid)
RETURNS TABLE (
  id uuid,
  invoice_number text,
  project_name text,
  customer_name text,
  customer_email text,
  invoice_date date,
  due_date date,
  subtotal numeric,
  tax_rate numeric,
  tax_amount numeric,
  total numeric,
  amount_paid numeric,
  balance_due numeric,
  deposit_received numeric,
  status text,
  notes text,
  payment_status text,
  paid_at timestamptz,
  display_mode text,
  invoice_type text,
  company_id uuid,
  updated_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    inv.id, inv.invoice_number, inv.project_name, inv.customer_name,
    inv.customer_email, inv.invoice_date, inv.due_date, inv.subtotal,
    inv.tax_rate, inv.tax_amount, inv.total, inv.amount_paid, inv.balance_due,
    inv.deposit_received, inv.status, inv.notes, inv.payment_status,
    inv.paid_at, inv.display_mode, inv.invoice_type, inv.company_id,
    inv.updated_at
  FROM invoices inv
  WHERE inv.id = p_invoice_id
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_invoice_for_public_view(uuid) TO anon, authenticated;

SELECT 'get_invoice_for_public_view created' AS status;
