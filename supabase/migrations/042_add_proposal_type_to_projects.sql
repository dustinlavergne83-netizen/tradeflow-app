-- Add proposal_type column to projects table
ALTER TABLE projects
ADD COLUMN proposal_type TEXT DEFAULT 'commercial-public';

-- Add check constraint for valid proposal types
ALTER TABLE projects
ADD CONSTRAINT valid_proposal_type
CHECK (proposal_type IN ('commercial-public', 'commercial-private', 'residential-contractor', 'residential-owner'));

-- Add comment
COMMENT ON COLUMN projects.proposal_type IS 'Default proposal type for this project: commercial-public, commercial-private, residential-contractor, or residential-owner';
