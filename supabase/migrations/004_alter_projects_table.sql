-- ====================================
-- ALTER PROJECTS TABLE - ADD MISSING COLUMNS
-- ====================================

-- Add company_id column if it doesn't exist (maps to created_by for compatibility)
-- Since you already have 'created_by', we'll use that as the company_id reference

-- Add Basic Information columns
ALTER TABLE projects ADD COLUMN IF NOT EXISTS customer TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS contractor TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS description TEXT;

-- Add Financial Details columns
ALTER TABLE projects ADD COLUMN IF NOT EXISTS budget DECIMAL(12,2) DEFAULT 0;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS labor_rate DECIMAL(10,2) DEFAULT 50;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS billed_amount DECIMAL(12,2) DEFAULT 0;

-- Add Project Details columns
ALTER TABLE projects ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS start_date DATE;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS end_date DATE;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS percent_complete DECIMAL(5,2) DEFAULT 0;

-- Create indexes for better performance (if they don't exist)
CREATE INDEX IF NOT EXISTS idx_projects_created_by ON projects(created_by);
CREATE INDEX IF NOT EXISTS idx_projects_customer ON projects(customer);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);

-- Update RLS policies if needed (assuming you already have basic RLS enabled)
-- If RLS is not enabled, uncomment the next line:
-- ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist and recreate them
DROP POLICY IF EXISTS "Users can view their own projects" ON projects;
DROP POLICY IF EXISTS "Users can insert their own projects" ON projects;
DROP POLICY IF EXISTS "Users can update their own projects" ON projects;
DROP POLICY IF EXISTS "Users can delete their own projects" ON projects;

-- Create RLS Policies using created_by column
CREATE POLICY "Users can view their own projects"
  ON projects FOR SELECT
  USING (auth.uid() = created_by);

CREATE POLICY "Users can insert their own projects"
  ON projects FOR INSERT
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update their own projects"
  ON projects FOR UPDATE
  USING (auth.uid() = created_by);

CREATE POLICY "Users can delete their own projects"
  ON projects FOR DELETE
  USING (auth.uid() = created_by);

-- Function to update updated_at timestamp (if doesn't exist)
CREATE OR REPLACE FUNCTION update_projects_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS projects_update_timestamp ON projects;

-- Create trigger to auto-update updated_at
CREATE TRIGGER projects_update_timestamp
BEFORE UPDATE ON projects
FOR EACH ROW
EXECUTE FUNCTION update_projects_updated_at();
