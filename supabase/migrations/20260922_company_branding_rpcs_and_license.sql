-- ============================================================
--  Per-company branding on public estimate/invoice view pages
--
--  QuickEstimateView.jsx and InvoiceView.jsx are public/shareable
--  pages — a customer clicking the link isn't signed in — so
--  branding can't come from useBrand()/AuthContext (which reads
--  the signed-in user's company). It must be resolved from the
--  estimate/invoice's OWN company instead.
--
--  Both RPCs are SECURITY DEFINER so they can resolve branding
--  without granting public SELECT on employees (which has no
--  public policy) or exposing more of companies than needed.
-- ============================================================

-- ── 1. license_number on companies ───────────────────────────
alter table public.companies add column if not exists license_number text;

update public.companies set license_number = '63147' where slug = 'dml';

-- Address fields were empty for both companies; populated here so
-- the estimate/invoice footer has something to show.
update public.companies
  set address = 'P.O. Box 363', city = 'Jennings', state = 'LA', zip = '70546'
  where slug in ('dml', 'dt-specialties');

update public.companies
  set contact_phone = '(337) 717-1182'
  where slug = 'dt-specialties';

-- ── 2. get_company_branding_for_estimate ─────────────────────
-- estimates.company_id is still the legacy auth.uid() convention
-- (only customers.company_id has been migrated to real
-- companies.id so far), so this resolves via employees.user_id.
create or replace function public.get_company_branding_for_estimate(p_estimate_id uuid)
returns table (
  id uuid, name text, logo_url text, primary_color text, secondary_color text,
  contact_phone text, contact_email text, address text, city text, state text, zip text, license_number text
)
language sql security definer set search_path = public as $$
  select co.id, co.name, co.logo_url, co.primary_color, co.secondary_color,
         co.contact_phone, co.contact_email, co.address, co.city, co.state, co.zip, co.license_number
  from estimates e
  join employees emp on emp.user_id = e.company_id
  join companies co on co.id = emp.company_id
  where e.id = p_estimate_id
  limit 1;
$$;

grant execute on function public.get_company_branding_for_estimate(uuid) to anon, authenticated;

-- ── 3. get_company_branding_for_invoice ──────────────────────
-- invoices.company_id is ALREADY the real companies.id (unlike
-- estimates/customers-before-migration), so this is a direct join,
-- no employees table involved.
create or replace function public.get_company_branding_for_invoice(p_invoice_id uuid)
returns table (
  id uuid, name text, logo_url text, primary_color text, secondary_color text,
  contact_phone text, contact_email text, address text, city text, state text, zip text, license_number text
)
language sql security definer set search_path = public as $$
  select co.id, co.name, co.logo_url, co.primary_color, co.secondary_color,
         co.contact_phone, co.contact_email, co.address, co.city, co.state, co.zip, co.license_number
  from invoices inv
  join companies co on co.id = inv.company_id
  where inv.id = p_invoice_id
  limit 1;
$$;

grant execute on function public.get_company_branding_for_invoice(uuid) to anon, authenticated;
