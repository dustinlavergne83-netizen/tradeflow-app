-- Add parent_id column to estimate_items table
-- This allows child components to reference their parent assembly

ALTER TABLE estimate_items 
ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES estimate_items(id) ON DELETE CASCADE;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_estimate_items_parent_id ON estimate_items(parent_id);

-- Add comment
COMMENT ON COLUMN estimate_items.parent_id IS 'References parent assembly row for child components';
