-- Add page_number column to plan_measurements table
ALTER TABLE plan_measurements
ADD COLUMN IF NOT EXISTS page_number INTEGER DEFAULT 1;

-- Add index for faster filtering by page
CREATE INDEX IF NOT EXISTS idx_plan_measurements_page 
ON plan_measurements(plan_id, page_number);
