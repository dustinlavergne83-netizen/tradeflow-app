-- ====================================
-- ADD change_order_id TO proposals TABLE
-- ====================================
-- This allows proposals to be linked to change orders
-- (not just estimates). The base_estimate_id has a FK to estimates,
-- so we can't store a change_order UUID there.

-- Add the change_order_id column
ALTER TABLE proposals 
ADD COLUMN IF NOT EXISTS change_order_id UUID REFERENCES change_orders(id) ON DELETE SET NULL;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_proposals_change_order ON proposals(change_order_id);

-- Verify the column was added
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'proposals' 
AND column_name IN ('base_estimate_id', 'change_order_id')
ORDER BY column_name;
