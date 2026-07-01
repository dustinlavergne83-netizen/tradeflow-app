-- Add source tracking columns to invoices table
-- These allow progress billing lookups to find "previously billed" invoices
-- without relying on fragile text parsing of the notes field.

alter table invoices
  add column if not exists source_proposal_id     uuid references proposals(id)     on delete set null,
  add column if not exists source_estimate_id     uuid references estimates(id)     on delete set null,
  add column if not exists source_change_order_id uuid references change_orders(id) on delete set null;

-- Index for fast look-ups when calculating "previously billed" amounts
create index if not exists idx_invoices_source_proposal_id
  on invoices(source_proposal_id)
  where source_proposal_id is not null;

create index if not exists idx_invoices_source_estimate_id
  on invoices(source_estimate_id)
  where source_estimate_id is not null;

create index if not exists idx_invoices_source_change_order_id
  on invoices(source_change_order_id)
  where source_change_order_id is not null;
