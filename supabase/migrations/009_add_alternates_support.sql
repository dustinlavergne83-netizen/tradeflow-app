-- Add alternates support to estimates table
-- This migration is NON-DESTRUCTIVE - it only adds new columns with safe defaults

-- Add alternate tracking fields to estimates table
ALTER TABLE estimates ADD COLUMN IF NOT EXISTS alternate_number INTEGER DEFAULT 0;
ALTER TABLE estimates ADD COLUMN IF NOT EXISTS alternate_title TEXT;
ALTER TABLE estimates ADD COLUMN IF NOT EXISTS parent_estimate_id UUID REFERENCES estimates(id) ON DELETE CASCADE;

-- Create index for faster alternate queries
CREATE INDEX IF NOT EXISTS idx_estimates_parent ON estimates(parent_estimate_id);
CREATE INDEX IF NOT EXISTS idx_estimates_alternate_number ON estimates(alternate_number);

-- Update existing estimates to be "Base Bid" (alternate 0)
UPDATE estimates 
SET alternate_number = 0, 
    alternate_title = 'Base Bid'
WHERE alternate_number IS NULL OR alternate_number = 0;

-- Add helpful comment
COMMENT ON COLUMN estimates.alternate_number IS '0 = Base Bid, 1+ = Alternates';
COMMENT ON COLUMN estimates.alternate_title IS 'Display name like "Base Bid", "Alt 1 - Exterior Lighting", etc.';
COMMENT ON COLUMN estimates.parent_estimate_id IS 'NULL for base bid, links to parent estimate for alternates';
