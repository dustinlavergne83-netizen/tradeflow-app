-- ============================================================
--  Service agreements — group several project_services rows
--  into one customer-facing arrangement (e.g. Christmas Lights:
--  install + storage + removal, all one deal), and let
--  project_services attach to a customer directly instead of
--  always requiring a project (recurring/subscription work like
--  lawn care contracts is not tied to any project).
--
--  Decision: new tables use companies.id (matches projects/
--  invoices), NOT customers' auth.uid()-based company_id. RLS on
--  `customers` only restricts which customer rows a user can see
--  when querying that table directly — it has no bearing on FKs
--  from other tables, so no bridging policy is needed here.
--  Existing app code (Customers.jsx, ProjectSetup.jsx) already
--  reads customer.id / employee.company_id straight from
--  Supabase and stores them as opaque foreign keys the same way.
--
--  All three project_services/service_contracts/contract_visits
--  tables are still empty (0 rows) as of this migration, so this
--  is a pure schema change with no backfill needed.
-- ============================================================

-- ── 1. service_agreements ────────────────────────────────────
-- The customer-facing "deal". One agreement can group several
-- project_services rows (e.g. Christmas Lights install one_off +
-- storage subscription + removal one_off, all linked as one
-- arrangement rather than three unrelated records).
create table if not exists public.service_agreements (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies(id),
  customer_id uuid not null references public.customers(id) on delete cascade,
  title       text not null,
  status      text not null default 'active'
              check (status in ('active', 'completed', 'cancelled')),
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.service_agreements enable row level security;

create policy "service_agreements_company_select"
  on public.service_agreements for select
  using (company_id = get_my_company_id());

create policy "service_agreements_company_insert"
  on public.service_agreements for insert
  with check (company_id = get_my_company_id());

create policy "service_agreements_company_update"
  on public.service_agreements for update
  using (company_id = get_my_company_id())
  with check (company_id = get_my_company_id());

create policy "service_agreements_company_delete"
  on public.service_agreements for delete
  using (company_id = get_my_company_id());

drop trigger if exists service_agreements_set_updated_at on public.service_agreements;
create trigger service_agreements_set_updated_at
  before update on public.service_agreements
  for each row execute function public.set_updated_at();

create index if not exists service_agreements_customer_id_idx on public.service_agreements (customer_id);
create index if not exists service_agreements_company_id_idx on public.service_agreements (company_id);

-- ── 2. project_services: decouple from projects ──────────────
-- project_id becomes optional (recurring/subscription work is
-- not tied to a project); add customer_id + agreement_id so a
-- service can attach directly to a customer/agreement instead.
alter table public.project_services
  alter column project_id drop not null,
  add column if not exists customer_id  uuid references public.customers(id) on delete cascade,
  add column if not exists agreement_id uuid references public.service_agreements(id) on delete cascade;

create index if not exists project_services_customer_id_idx on public.project_services (customer_id);
create index if not exists project_services_agreement_id_idx on public.project_services (agreement_id);

-- Every service must be anchored to a project OR a customer (never
-- neither) — otherwise it's an orphaned record no UI could ever find.
alter table public.project_services
  drop constraint if exists project_services_has_anchor;
alter table public.project_services
  add constraint project_services_has_anchor
  check (project_id is not null or customer_id is not null);
