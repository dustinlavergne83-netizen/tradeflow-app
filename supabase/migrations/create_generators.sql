-- ============================================================
--  Generators & Generator Brands tables
--  Run this in your Supabase SQL Editor
-- ============================================================

-- ── 1. generator_brands ──────────────────────────────────────
create table if not exists public.generator_brands (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null,
  name        text not null,
  created_at  timestamptz not null default now(),
  unique (company_id, name)
);

-- Seed default brands for every company that adds one
-- (brands are inserted per-company on first use; see app logic)

alter table public.generator_brands enable row level security;

create policy "company members can manage their brands"
  on public.generator_brands
  for all
  using  (company_id = auth.uid())
  with check (company_id = auth.uid());

-- ── 2. generators ────────────────────────────────────────────
create table if not exists public.generators (
  id                      uuid primary key default gen_random_uuid(),
  company_id              uuid not null,

  -- Customer link (optional FK — null-safe if customer is deleted)
  customer_id             uuid references public.customers(id) on delete set null,
  customer_name           text not null default '',
  customer_address        text not null default '',
  customer_phone          text not null default '',
  customer_email          text not null default '',

  -- Generator details
  brand                   text not null default '',
  model                   text not null default '',
  serial_number           text not null default '',
  kw_size                 numeric(10,2),
  fuel_type               text not null default 'Natural Gas',  -- Natural Gas | Propane | Diesel | Liquid Propane

  -- Transfer switch
  transfer_switch_brand   text not null default '',
  transfer_switch_model   text not null default '',

  -- Service tracking
  install_date            date,
  last_service_date       date,
  service_interval_months integer not null default 12,
  next_service_date       date,   -- auto-populated by app but stored here

  -- Meta
  notes                   text not null default '',
  status                  text not null default 'active',  -- active | needs_service | decommissioned

  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

alter table public.generators enable row level security;

create policy "company members can manage their generators"
  on public.generators
  for all
  using  (company_id = auth.uid())
  with check (company_id = auth.uid());

-- ── 3. updated_at trigger ────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists generators_set_updated_at on public.generators;
create trigger generators_set_updated_at
  before update on public.generators
  for each row execute function public.set_updated_at();

-- ── 4. Helpful index ─────────────────────────────────────────
create index if not exists generators_company_id_idx on public.generators (company_id);
create index if not exists generators_customer_id_idx on public.generators (customer_id);
create index if not exists generators_next_service_idx on public.generators (company_id, next_service_date);
