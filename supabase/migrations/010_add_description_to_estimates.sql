-- Add description/scope of work field to estimates table
ALTER TABLE estimates
ADD COLUMN description TEXT;

-- Add comment
COMMENT ON COLUMN estimates.description IS 'Scope of work description that appears on proposals';
