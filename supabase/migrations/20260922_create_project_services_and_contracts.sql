-- ============================================================
--  Multi-service projects + recurring service contracts
--  (built for DT Specialties — lawn care, landscaping,
--   Christmas lighting, decks, etc. — one project/customer
--   can have several services, some one-off, some recurring,
--   some flat subscriptions with no scheduled visit)
--
--  This is purely additive: no existing table's columns are
--  changed except two new nullable FKs on invoice_items.
--  DML is unaffected until it opts in — nothing here is wired
--  into any existing page yet.
-- ============================================================

-- ── 1. project_services ─────────────────────────────────────
-- The middle layer between a project and its actual work.
-- kind:
--   'one_off'      — single job, priced via a linked estimate
--   'recurring'    — visit-based recurring work (lawn care)
--   'subscription' — flat recurring charge, no visits to
--                    schedule (e.g. Christmas light storage)
create table if not exists public.project_services (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references public.companies(id),
  project_id   uuid not null references public.projects(id) on delete cascade,
  service_key  text not null,
  label        text not null,
  kind         text not null default 'one_off'
               check (kind in ('one_off', 'recurring', 'subscription')),
  status       text not null default 'active'
               check (status in ('active', 'completed', 'cancelled')),
  estimate_id  uuid references public.estimates(id) on delete set null,
  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table public.project_services enable row level security;

create policy "project_services_company_select"
  on public.project_services for select
  using (company_id = get_my_company_id());

create policy "project_services_company_insert"
  on public.project_services for insert
  with check (company_id = get_my_company_id());

create policy "project_services_company_update"
  on public.project_services for update
  using (company_id = get_my_company_id())
  with check (company_id = get_my_company_id());

create policy "project_services_company_delete"
  on public.project_services for delete
  using (company_id = get_my_company_id());

drop trigger if exists project_services_set_updated_at on public.project_services;
create trigger project_services_set_updated_at
  before update on public.project_services
  for each row execute function public.set_updated_at();

create index if not exists project_services_project_id_idx on public.project_services (project_id);
create index if not exists project_services_company_id_idx on public.project_services (company_id);

-- ── 2. service_contracts ─────────────────────────────────────
-- Recurring terms for a project_service of kind 'recurring' or
-- 'subscription'. frequency drives auto-scheduling for
-- 'recurring' contracts; it's informational only for
-- 'subscription' contracts (no visits are ever generated).
create table if not exists public.service_contracts (
  id                 uuid primary key default gen_random_uuid(),
  company_id         uuid not null references public.companies(id),
  project_service_id uuid not null references public.project_services(id) on delete cascade,
  frequency          text not null
                     check (frequency in ('weekly', 'biweekly', 'monthly', 'seasonal', 'custom')),
  interval_days      integer,               -- only used when frequency = 'custom'
  start_date         date not null,
  end_date           date,                  -- null = ongoing
  rate               numeric(10,2),
  billing_cadence    text not null default 'per_visit'
                     check (billing_cadence in ('per_visit', 'monthly')),
  next_visit_date    date,                  -- null for subscriptions (no visits)
  status             text not null default 'active'
                     check (status in ('active', 'paused', 'ended')),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

alter table public.service_contracts enable row level security;

create policy "service_contracts_company_select"
  on public.service_contracts for select
  using (company_id = get_my_company_id());

create policy "service_contracts_company_insert"
  on public.service_contracts for insert
  with check (company_id = get_my_company_id());

create policy "service_contracts_company_update"
  on public.service_contracts for update
  using (company_id = get_my_company_id())
  with check (company_id = get_my_company_id());

create policy "service_contracts_company_delete"
  on public.service_contracts for delete
  using (company_id = get_my_company_id());

drop trigger if exists service_contracts_set_updated_at on public.service_contracts;
create trigger service_contracts_set_updated_at
  before update on public.service_contracts
  for each row execute function public.set_updated_at();

create index if not exists service_contracts_project_service_id_idx on public.service_contracts (project_service_id);
create index if not exists service_contracts_company_id_idx on public.service_contracts (company_id);
create index if not exists service_contracts_next_visit_idx on public.service_contracts (company_id, next_visit_date);

-- ── 3. contract_visits ───────────────────────────────────────
-- The actual calendar. Only ever populated for contracts whose
-- service_contracts.next_visit_date is non-null (i.e. 'recurring'
-- kind, not 'subscription'). A crew-scheduling view queries this
-- table filtered/grouped by scheduled_date and employee_id.
create table if not exists public.contract_visits (
  id             uuid primary key default gen_random_uuid(),
  company_id     uuid not null references public.companies(id),
  contract_id    uuid not null references public.service_contracts(id) on delete cascade,
  scheduled_date date not null,
  employee_id    uuid references public.employees(id) on delete set null,
  status         text not null default 'scheduled'
                 check (status in ('scheduled', 'completed', 'skipped', 'invoiced')),
  completed_at   timestamptz,
  invoice_id     uuid references public.invoices(id) on delete set null,
  notes          text,
  created_at     timestamptz not null default now()
);

alter table public.contract_visits enable row level security;

create policy "contract_visits_company_select"
  on public.contract_visits for select
  using (company_id = get_my_company_id());

create policy "contract_visits_company_insert"
  on public.contract_visits for insert
  with check (company_id = get_my_company_id());

create policy "contract_visits_company_update"
  on public.contract_visits for update
  using (company_id = get_my_company_id())
  with check (company_id = get_my_company_id());

create policy "contract_visits_company_delete"
  on public.contract_visits for delete
  using (company_id = get_my_company_id());

create index if not exists contract_visits_contract_id_idx on public.contract_visits (contract_id);
create index if not exists contract_visits_company_id_idx on public.contract_visits (company_id);
create index if not exists contract_visits_scheduled_date_idx on public.contract_visits (company_id, scheduled_date);
create index if not exists contract_visits_employee_id_idx on public.contract_visits (employee_id);

-- ── 4. Auto-generate the next visit on completion ────────────
-- When a contract_visits row is marked 'completed', insert the
-- next one based on the parent contract's frequency, and advance
-- service_contracts.next_visit_date to match. Stops advancing
-- once the contract has an end_date in the past or its status
-- is no longer 'active'.
create or replace function public.advance_contract_visit()
returns trigger language plpgsql as $$
declare
  c record;
  next_date date;
begin
  if new.status = 'completed' and (old.status is distinct from 'completed') then
    select * into c from public.service_contracts where id = new.contract_id;

    if c.status = 'active' then
      next_date := case c.frequency
        when 'weekly'   then new.scheduled_date + interval '7 days'
        when 'biweekly' then new.scheduled_date + interval '14 days'
        when 'monthly'  then new.scheduled_date + interval '1 month'
        when 'custom'   then new.scheduled_date + make_interval(days => coalesce(c.interval_days, 7))
        else null  -- 'seasonal' contracts are scheduled manually, not auto-advanced
      end;

      if next_date is not null and (c.end_date is null or next_date <= c.end_date) then
        insert into public.contract_visits (company_id, contract_id, scheduled_date, employee_id)
        values (c.company_id, c.id, next_date, new.employee_id);

        update public.service_contracts
          set next_visit_date = next_date
          where id = c.id;
      end if;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists contract_visits_advance on public.contract_visits;
create trigger contract_visits_advance
  after update on public.contract_visits
  for each row execute function public.advance_contract_visit();

-- ── 5. Combined invoicing ────────────────────────────────────
-- Lets one invoice pull line items from several services/visits
-- under the same project. Nullable + additive: existing
-- invoice_items rows (all sourced from a single estimate) are
-- unaffected.
alter table public.invoice_items
  add column if not exists project_service_id uuid references public.project_services(id) on delete set null,
  add column if not exists contract_visit_id  uuid references public.contract_visits(id) on delete set null;

create index if not exists invoice_items_project_service_id_idx on public.invoice_items (project_service_id);
create index if not exists invoice_items_contract_visit_id_idx on public.invoice_items (contract_visit_id);
