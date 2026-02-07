-- Add page_number to plan_calibrations table
ALTER TABLE plan_calibrations
ADD COLUMN IF NOT EXISTS page_number INTEGER DEFAULT 1;

-- Drop the old unique constraint on plan_id
ALTER TABLE plan_calibrations
DROP CONSTRAINT IF EXISTS plan_calibrations_plan_id_key;

-- Add new unique constraint on plan_id + page_number
ALTER TABLE plan_calibrations
ADD CONSTRAINT plan_calibrations_plan_id_page_number_key 
UNIQUE (plan_id, page_number);

-- Update existing calibrations to be for page 1
UPDATE plan_calibrations
SET page_number = 1
WHERE page_number IS NULL;

-- Make page_number NOT NULL
ALTER TABLE plan_calibrations
ALTER COLUMN page_number SET NOT NULL;

COMMENT ON COLUMN plan_calibrations.page_number IS 'Page number this calibration applies to (allows different scales per page)';
