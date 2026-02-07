-- Add active_worth column to projects table
-- This stores the contract value (what customer will pay)

ALTER TABLE projects
ADD COLUMN IF NOT EXISTS active_worth DECIMAL(10, 2) DEFAULT 0;

-- Add comment
COMMENT ON COLUMN projects.active_worth IS 'Contract value - what the customer will pay (revenue)';
COMMENT ON COLUMN projects.budget IS 'Internal cost estimate - what we plan to spend';
