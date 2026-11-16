-- ============================================================
--  Fix estimate_items DELETE policies: add get_my_company_id()
--  support, matching the SELECT/INSERT/UPDATE policies already
--  fixed by migration 096.
--
--  Problem: after 20261109_estimates_company_id_to_real_company
--  moved estimates.company_id to real companies.id values, the
--  only two DELETE policies on estimate_items still checked
--  estimates.company_id = auth.uid() -- which is now never true.
--  A DELETE blocked by RLS does not raise an error; it simply
--  deletes 0 rows and returns success. QuickEstimate.jsx's
--  insert-first-then-delete-old-items update flow relies on that
--  delete actually working, so every edit of an existing estimate
--  (or change order) silently left the old line items behind and
--  added a full duplicate copy of the new ones on top.
--
--  This migration only adds/replaces the DELETE policy. It does
--  not touch the data-cleanup of already-duplicated rows -- that
--  is handled separately after review.
-- ============================================================

drop policy if exists "Users can delete estimate items" on public.estimate_items;
drop policy if exists "Company members can delete estimate items" on public.estimate_items;
drop policy if exists "Supervisors can delete company estimate items" on public.estimate_items;

create policy "Supervisors can delete company estimate items"
on public.estimate_items for delete
to authenticated
using (
  exists (
    select 1 from public.estimates
    where estimates.id = estimate_items.estimate_id
      and (estimates.company_id = auth.uid() or estimates.company_id = get_my_company_id())
  )
  or exists (
    select 1 from public.change_orders
    where change_orders.id = estimate_items.change_order_id
      and change_orders.created_by = auth.uid()
  )
);
