-- Create project_contractors table
CREATE TABLE IF NOT EXISTS project_contractors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  contractor_name TEXT NOT NULL,
  company_name TEXT,
  email TEXT,
  phone TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX idx_project_contractors_project_id ON project_contractors(project_id);

-- Add RLS policies
ALTER TABLE project_contractors ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view contractors for their own projects
CREATE POLICY "Users can view contractors for their projects"
  ON project_contractors
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM projects 
      WHERE projects.id = project_contractors.project_id 
      AND projects.created_by = auth.uid()
    )
  );

-- Policy: Users can insert contractors for their own projects
CREATE POLICY "Users can insert contractors for their projects"
  ON project_contractors
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects 
      WHERE projects.id = project_contractors.project_id 
      AND projects.created_by = auth.uid()
    )
  );

-- Policy: Users can update contractors for their own projects
CREATE POLICY "Users can update contractors for their projects"
  ON project_contractors
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM projects 
      WHERE projects.id = project_contractors.project_id 
      AND projects.created_by = auth.uid()
    )
  );

-- Policy: Users can delete contractors for their own projects
CREATE POLICY "Users can delete contractors for their projects"
  ON project_contractors
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM projects 
      WHERE projects.id = project_contractors.project_id 
      AND projects.created_by = auth.uid()
    )
  );
