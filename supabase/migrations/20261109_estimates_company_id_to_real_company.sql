-- ============================================================
--  Migrate estimates.company_id from the creating admin's
--  auth.uid() to the real companies.id, matching customers/
--  projects/invoices/proposals/assemblies.
--
--  Problem: estimates.company_id stored the CREATING ADMIN's
--  auth.uid() (FK -> auth.users), not a real company id. The
--  "Supervisors can insert company estimates" INSERT policy
--  (migration 096) accepts BOTH auth.uid() and
--  get_my_company_id() (a real companies.id) via an OR clause,
--  so inserts from QuickEstimate.jsx -- which correctly writes
--  company_id: employee.company_id (a real companies.id) --
--  passed RLS, but then failed with:
--    insert or update on table "estimates" violates foreign key
--    constraint "estimates_company_id_fkey"
--  because that FK still pointed at auth.users, and a real
--  companies.id is never a row in auth.users.
--
--  Verified before running: every existing estimates.company_id
--  value matches exactly one employees.user_id, and every one of
--  those employees has a non-null employees.company_id -- so this
--  backfill is a safe, lossless, full-table migration (0 orphans).
-- ============================================================

-- ── 1. Drop the FK to auth.users, add the new one as NOT VALID
--      (skips checking existing rows immediately -- they still
--      hold auth.uid() values at this point, which would fail
--      validation before the backfill below has run) ─────────
alter table public.estimates
  drop constraint if exists estimates_company_id_fkey;

alter table public.estimates
  add constraint estimates_company_id_fkey
  foreign key (company_id) references public.companies(id) on delete cascade
  not valid;

-- ── 2. Backfill: map every estimate's old auth.uid() value to
--      the real company that creating employee belongs to ──────
update public.estimates est
set company_id = e.company_id
from public.employees e
where est.company_id = e.user_id
  and e.company_id is not null;

-- ── 2b. Now that every row holds a real companies.id, validate
--       the constraint for real ─────────────────────────────
alter table public.estimates
  validate constraint estimates_company_id_fkey;

-- ── 3. Replace the auth.uid()-only policies with ones that also
--      accept get_my_company_id(), matching the pattern already
--      used for customers/assemblies/invoices/proposals. Keep the
--      existing "Supervisors can ..." policies from migration 096
--      as-is (their OR clauses already handle both id spaces). ──
drop policy if exists "Users can view their own estimates" on public.estimates;
drop policy if exists "Users can insert their own estimates" on public.estimates;
drop policy if exists "Users can update their own estimates" on public.estimates;
drop policy if exists "Users can delete their own estimates" on public.estimates;

create policy "estimates_company_select"
  on public.estimates for select
  using (company_id = get_my_company_id());

create policy "estimates_company_insert"
  on public.estimates for insert
  with check (company_id = get_my_company_id());

create policy "estimates_company_update"
  on public.estimates for update
  using (company_id = get_my_company_id())
  with check (company_id = get_my_company_id());

create policy "estimates_company_delete"
  on public.estimates for delete
  using (company_id = get_my_company_id());
