-- ============================================
-- RUN THIS IN SUPABASE DASHBOARD SQL EDITOR
-- ============================================
-- Add Winning Proposal Tracking to Projects

-- Add winning_proposal_id to projects table
ALTER TABLE projects
ADD COLUMN IF NOT EXISTS winning_proposal_id UUID REFERENCES proposals(id) ON DELETE SET NULL;

-- Add index for better performance
CREATE INDEX IF NOT EXISTS idx_projects_winning_proposal 
ON projects(winning_proposal_id);

-- Done! Projects can now track which proposal won the job!
