-- ============================================================
--  Migrate customers.company_id from admin auth.uid() to the
--  real companies.id, matching projects/invoices/estimates.
--
--  Problem: customers.company_id stored the CREATING ADMIN's
--  auth.uid(), not a real company id. So a second employee at
--  the same company (e.g. ty@dtspecialties.com, who did not
--  create any customer rows) matched neither the auth.uid()
--  policy nor the company_id = get_my_company_id() policy, and
--  saw zero customers.
--
--  Backed up beforehand: all 262 (id, company_id) pairs written
--  to a local JSON file before this ran, so the pre-migration
--  state is fully recoverable if anything here needs reverting.
--
--  This migration ONLY touches customers. estimates/vendors/
--  proposals/etc. still use the old auth.uid() convention and
--  are unaffected — deliberately staged as a separate change.
-- ============================================================

-- ── 1. Drop the FK to auth.users, add the new one as NOT VALID
--      (skips checking existing rows immediately — they still
--      hold auth.uid() values at this point, which would fail
--      validation before the backfill below has run) ─────────
alter table public.customers
  drop constraint if exists customers_company_id_fkey;

alter table public.customers
  add constraint customers_company_id_fkey
  foreign key (company_id) references public.companies(id) on delete cascade
  not valid;

-- ── 2. Backfill: map each customer's old auth.uid() value to
--      the real company that admin belongs to ──────────────
update public.customers cu
set company_id = e.company_id
from public.employees e
where cu.company_id = e.user_id
  and e.company_id is not null;

-- ── 2b. Now that every row holds a real companies.id, validate
--       the constraint for real ─────────────────────────────
alter table public.customers
  validate constraint customers_company_id_fkey;

-- ── 3. Replace the auth.uid()-based policies with company-id
--      based ones, matching projects/invoices ───────────────
drop policy if exists "Users can view their own customers" on public.customers;
drop policy if exists "Users can insert their own customers" on public.customers;
drop policy if exists "Users can update their own customers" on public.customers;
drop policy if exists "Users can delete their own customers" on public.customers;

-- "Employees can read company customers" (SELECT, company_id = get_my_company_id())
-- and "Customers can read own record" (customer portal) already exist and are kept.

drop policy if exists "customers_company_update" on public.customers;
create policy "customers_company_update"
  on public.customers for update
  using (company_id = get_my_company_id())
  with check (company_id = get_my_company_id());

drop policy if exists "customers_company_delete" on public.customers;
create policy "customers_company_delete"
  on public.customers for delete
  using (company_id = get_my_company_id());

-- "Employees can insert company customers" (INSERT) already allows
-- company_id = get_my_company_id() via its OR clause — kept as-is.
