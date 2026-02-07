-- Add section field to estimate_items to support multi-section estimates
-- This allows organizing estimate items by Lighting, Devices, Branch, Feeders, etc.

ALTER TABLE estimate_items 
ADD COLUMN section TEXT DEFAULT 'general';

-- Add index for section queries
CREATE INDEX idx_estimate_items_section ON estimate_items(estimate_id, section);

-- Add comment
COMMENT ON COLUMN estimate_items.section IS 'Estimate section: lighting, devices, branch, feeders, equipment, special_systems, general';
