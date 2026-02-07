-- Add parent_id column to change_order_items table

ALTER TABLE change_order_items 
ADD COLUMN IF NOT EXISTS parent_id INTEGER REFERENCES change_order_items(id);

-- Add parent_id column to estimate_items table (if not exists)
ALTER TABLE estimate_items 
ADD COLUMN IF NOT EXISTS parent_id INTEGER REFERENCES estimate_items(id);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_change_order_items_parent_id ON change_order_items(parent_id);
CREATE INDEX IF NOT EXISTS idx_estimate_items_parent_id ON estimate_items(parent_id);

-- Check the columns exist now
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'change_order_items' 
  AND column_name = 'parent_id';

SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'estimate_items' 
  AND column_name = 'parent_id';
