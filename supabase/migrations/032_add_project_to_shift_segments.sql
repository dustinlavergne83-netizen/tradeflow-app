-- Add project_id to shift_segments table
ALTER TABLE shift_segments ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_shift_segments_project ON shift_segments(project_id);

-- Update RLS policies to allow project-based queries
-- (existing policies remain, just adding ability to query by project)
