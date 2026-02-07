-- ====================================
-- PROJECTS TABLE
-- ====================================

CREATE TABLE projects (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Basic Information
  name TEXT NOT NULL,
  customer TEXT,
  contractor TEXT,
  address TEXT,
  description TEXT,
  
  -- Financial Details
  budget DECIMAL(12,2) DEFAULT 0,
  labor_rate DECIMAL(10,2) DEFAULT 50,
  billed_amount DECIMAL(12,2) DEFAULT 0,
  
  -- Project Details
  status TEXT DEFAULT 'active', -- 'active', 'pending', 'completed', 'on-hold'
  start_date DATE,
  end_date DATE,
  percent_complete DECIMAL(5,2) DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for performance
CREATE INDEX idx_projects_company ON projects(company_id);
CREATE INDEX idx_projects_customer ON projects(customer);
CREATE INDEX idx_projects_status ON projects(status);

-- Enable Row Level Security
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

-- RLS Policies for projects
CREATE POLICY "Users can view their own projects"
  ON projects FOR SELECT
  USING (auth.uid() = company_id);

CREATE POLICY "Users can insert their own projects"
  ON projects FOR INSERT
  WITH CHECK (auth.uid() = company_id);

CREATE POLICY "Users can update their own projects"
  ON projects FOR UPDATE
  USING (auth.uid() = company_id);

CREATE POLICY "Users can delete their own projects"
  ON projects FOR DELETE
  USING (auth.uid() = company_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_projects_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
CREATE TRIGGER projects_update_timestamp
BEFORE UPDATE ON projects
FOR EACH ROW
EXECUTE FUNCTION update_projects_updated_at();
