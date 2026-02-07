-- Run this in Supabase Dashboard > SQL Editor

-- Add proposal_type column to projects table
ALTER TABLE projects
ADD COLUMN IF NOT EXISTS proposal_type TEXT DEFAULT 'commercial-public';

-- Add check constraint for valid proposal types
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'valid_proposal_type'
  ) THEN
    ALTER TABLE projects
    ADD CONSTRAINT valid_proposal_type
    CHECK (proposal_type IN ('commercial-public', 'commercial-private', 'residential-contractor', 'residential-owner'));
  END IF;
END
$$;

-- Update any NULL values to default
UPDATE projects 
SET proposal_type = 'commercial-public' 
WHERE proposal_type IS NULL;

SELECT 'Migration complete! proposal_type column added to projects table.' as status;
