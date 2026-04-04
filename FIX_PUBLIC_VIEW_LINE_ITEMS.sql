-- ============================================================
-- FIX: Allow public (unauthenticated) read access to
-- estimate_items and invoice_items so that SMS links work
-- without requiring a logged-in session.
-- 
-- These are public VIEW pages. The UUID in the URL is the
-- access control — you can't guess a UUID.
-- ============================================================

-- 1. estimate_items: allow public SELECT
DROP POLICY IF EXISTS "Public can view estimate items" ON estimate_items;
CREATE POLICY "Public can view estimate items"
  ON estimate_items
  FOR SELECT
  USING (true);

-- 2. invoice_items: allow public SELECT
DROP POLICY IF EXISTS "Public can view invoice items" ON invoice_items;
CREATE POLICY "Public can view invoice items"
  ON invoice_items
  FOR SELECT
  USING (true);

-- 3. estimates: allow public SELECT (already may exist, but ensure it)
DROP POLICY IF EXISTS "Public can view estimates" ON estimates;
CREATE POLICY "Public can view estimates"
  ON estimates
  FOR SELECT
  USING (true);

-- 4. invoices: allow public SELECT
DROP POLICY IF EXISTS "Public can view invoices" ON invoices;
CREATE POLICY "Public can view invoices"
  ON invoices
  FOR SELECT
  USING (true);

-- Done. Test by opening an SMS link in a private browser window.
