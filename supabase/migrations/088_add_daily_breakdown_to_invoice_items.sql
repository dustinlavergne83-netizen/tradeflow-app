-- Add daily_breakdown column to invoice_items table for storing daily hours breakdown
ALTER TABLE invoice_items 
ADD COLUMN IF NOT EXISTS daily_breakdown JSONB DEFAULT NULL;

-- Add comment for clarity
COMMENT ON COLUMN invoice_items.daily_breakdown IS 'JSON object storing daily breakdown: {"2026-02-01": {"hours": 8, "notes": "comment"}, ...}';
