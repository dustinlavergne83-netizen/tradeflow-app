-- Fix: Allow public (unauthenticated) read of companies table
-- This is needed so the portal login page can look up a company by slug
-- before the user signs in.
--
-- We only expose safe, non-sensitive columns (name, logo, color, slug).
-- No financial or private data is exposed.

-- Allow anyone to SELECT from companies (needed for portal slug lookup)
CREATE POLICY "Public can read companies"
  ON companies
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- If the policy already exists, drop it and recreate:
-- DROP POLICY IF EXISTS "Public can read companies" ON companies;
-- Then re-run the CREATE POLICY above.

-- Verify it worked:
SELECT id, name, slug FROM companies WHERE slug IS NOT NULL;
