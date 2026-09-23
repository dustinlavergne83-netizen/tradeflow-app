-- ============================================================
--  Migrate assemblies.company_id from the creating admin's
--  auth.uid() to the real companies.id, matching customers/
--  projects/invoices/estimates.
--
--  Problem: assemblies.company_id stored the CREATING ADMIN's
--  auth.uid() (references auth.users), not a real company id.
--  A later RLS policy "assemblies_company_isolation" was added
--  comparing company_id = get_my_company_id() (which returns
--  employees.company_id, a real companies.id) -- these two ID
--  spaces never match, so ALL assemblies became invisible to
--  ALL users, including the admin who created them.
--
--  Scope: this migration only touches assemblies whose
--  company_id currently equals an auth.uid() belonging to an
--  employee of DML Electrical Service, LLC
--  (company id 9a999997-7109-4239-9c4b-a6d94dd003b6).
--  No other tenant's data is modified.
-- ============================================================

-- ── 1. Drop the FK to auth.users, add the new one (as NOT VALID
--      so existing non-DML rows that still hold auth.uid()
--      values don't block this migration) ─────────────────────
alter table public.assemblies
  drop constraint if exists assemblies_company_id_fkey;

alter table public.assemblies
  add constraint assemblies_company_id_fkey
  foreign key (company_id) references public.companies(id) on delete cascade
  not valid;

-- ── 2. Backfill: map DML's assemblies from the creating admin's
--      auth.uid() to DML's real company id ─────────────────────
update public.assemblies a
set company_id = e.company_id,
    updated_at = now()
from public.employees e
where a.company_id = e.user_id
  and e.company_id = '9a999997-7109-4239-9c4b-a6d94dd003b6';

-- ── 3. Replace the broken isolation policy with one that works
--      now that company_id holds real companies.id values for
--      DML. (Non-DML rows are left as-is for now and will simply
--      remain governed by this same policy once their own
--      migration is run.) ───────────────────────────────────────
drop policy if exists "assemblies_company_isolation" on public.assemblies;

create policy "assemblies_company_select"
  on public.assemblies for select
  using (company_id = get_my_company_id());

create policy "assemblies_company_insert"
  on public.assemblies for insert
  with check (company_id = get_my_company_id());

create policy "assemblies_company_update"
  on public.assemblies for update
  using (company_id = get_my_company_id())
  with check (company_id = get_my_company_id());

create policy "assemblies_company_delete"
  on public.assemblies for delete
  using (company_id = get_my_company_id());
