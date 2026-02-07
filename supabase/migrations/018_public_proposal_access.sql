-- Enable public read access for proposals (similar to invoices)

-- Drop existing policies if any
DROP POLICY IF EXISTS "Public can view proposals" ON proposals;
DROP POLICY IF EXISTS "Public can view proposal_alternates" ON proposal_alternates;

-- Allow public read access to proposals table
CREATE POLICY "Public can view proposals"
ON proposals FOR SELECT
USING (true);

-- Allow public read access to proposal_alternates table
CREATE POLICY "Public can view proposal_alternates"
ON proposal_alternates FOR SELECT
USING (true);

-- Note: estimates, projects, and project_contractors should already have read policies
-- But let's ensure they exist for public access

DROP POLICY IF EXISTS "Public can view estimates" ON estimates;
DROP POLICY IF EXISTS "Public can view projects" ON projects;
DROP POLICY IF EXISTS "Public can view project_contractors" ON project_contractors;

CREATE POLICY "Public can view estimates"
ON estimates FOR SELECT
USING (true);

CREATE POLICY "Public can view projects"
ON projects FOR SELECT
USING (true);

CREATE POLICY "Public can view project_contractors"
ON project_contractors FOR SELECT
USING (true);
