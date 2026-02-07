-- Allow public read access to invoices and invoice_items for customer viewing

-- Drop existing select policies if they exist
DROP POLICY IF EXISTS "Users can view their own invoices" ON invoices;
DROP POLICY IF EXISTS "Users can view invoice items" ON invoice_items;

-- Create policy to allow public read access to invoices
CREATE POLICY "Anyone can view invoices"
  ON invoices
  FOR SELECT
  USING (true);

-- Create policy to allow public read access to invoice items
CREATE POLICY "Anyone can view invoice items"
  ON invoice_items
  FOR SELECT
  USING (true);

-- Keep the existing insert/update/delete policies restricted to authenticated users
-- (These should already exist from previous migrations)
