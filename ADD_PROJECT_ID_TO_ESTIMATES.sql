-- Add project_id column to estimates table
-- This links estimates to projects by ID (stable, not affected by name changes)

ALTER TABLE estimates ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES projects(id) ON DELETE SET NULL;

-- Create an index for faster lookups
CREATE INDEX IF NOT EXISTS idx_estimates_project_id ON estimates(project_id);

-- Backfill existing estimates: try to match by project_name → project name
-- (best-effort; unmatched estimates will have NULL project_id which is fine)
UPDATE estimates e
SET project_id = p.id
FROM projects p
WHERE e.project_name = p.name
  AND e.project_id IS NULL;
