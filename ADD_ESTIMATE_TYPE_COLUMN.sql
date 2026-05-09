-- Add estimate_type column to track which editor created the estimate
-- 'quick' = Quick Estimate editor, 'full' = Full Estimate editor
-- Default to 'quick' so existing estimates maintain backward-compatible behavior

ALTER TABLE estimates ADD COLUMN IF NOT EXISTS estimate_type TEXT DEFAULT 'quick';

-- Verify the column was added
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'estimates' AND column_name = 'estimate_type';
