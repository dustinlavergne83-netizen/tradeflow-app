-- Add parent_id column with correct UUID type

-- For change_order_items
ALTER TABLE change_order_items 
ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES change_order_items(id);

-- For estimate_items  
ALTER TABLE estimate_items 
ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES estimate_items(id);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_change_order_items_parent_id ON change_order_items(parent_id);
CREATE INDEX IF NOT EXISTS idx_estimate_items_parent_id ON estimate_items(parent_id);

-- Verify columns were added
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name IN ('change_order_items', 'estimate_items')
  AND column_name = 'parent_id';
