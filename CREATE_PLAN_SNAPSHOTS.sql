-- Create plan_snapshots table for storing takeoff area snapshots
-- Run this in your Supabase SQL editor

CREATE TABLE IF NOT EXISTS plan_snapshots (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID,
  plan_id UUID,
  page_number INT DEFAULT 1,
  label TEXT,
  image_url TEXT NOT NULL,
  image_path TEXT,
  company_id UUID,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add index for fast lookups by project and plan
CREATE INDEX IF NOT EXISTS idx_plan_snapshots_project_id ON plan_snapshots(project_id);
CREATE INDEX IF NOT EXISTS idx_plan_snapshots_plan_id ON plan_snapshots(plan_id);
CREATE INDEX IF NOT EXISTS idx_plan_snapshots_company_id ON plan_snapshots(company_id);

-- Enable Row Level Security
ALTER TABLE plan_snapshots ENABLE ROW LEVEL SECURITY;

-- Policy: users can manage their own company's snapshots
CREATE POLICY "Users can manage their own snapshots"
  ON plan_snapshots
  FOR ALL
  USING (company_id = auth.uid());

-- Grant permissions
GRANT ALL ON plan_snapshots TO authenticated;
GRANT ALL ON plan_snapshots TO service_role;
