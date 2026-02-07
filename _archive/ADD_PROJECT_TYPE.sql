-- Run this in Supabase Dashboard > SQL Editor

-- Add project_type column to projects table
ALTER TABLE projects
ADD COLUMN IF NOT EXISTS project_type TEXT DEFAULT 'commercial-public';

-- Add check constraint for valid project types
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'valid_project_type'
  ) THEN
    ALTER TABLE projects
    ADD CONSTRAINT valid_project_type
    CHECK (project_type IN ('commercial-public', 'commercial-private', 'residential-contractor', 'residential-owner'));
  END IF;
END
$$;

-- Update any NULL values to default
UPDATE projects 
SET project_type = 'commercial-public' 
WHERE project_type IS NULL;

SELECT 'Migration complete! project_type column added to projects table.' as status;
