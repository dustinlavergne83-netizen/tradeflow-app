-- Simple fix: Delete ALL calibrations and start fresh
-- You'll need to re-calibrate your pages, but this fixes the duplicate issue

-- Step 1: Drop the constraint temporarily
ALTER TABLE plan_calibrations
DROP CONSTRAINT IF EXISTS plan_calibrations_plan_id_page_number_key;

-- Step 2: Delete ALL calibrations (start fresh)
DELETE FROM plan_calibrations;

-- Step 3: Re-add the constraint
ALTER TABLE plan_calibrations
ADD CONSTRAINT plan_calibrations_plan_id_page_number_key 
UNIQUE (plan_id, page_number);

-- Verify table is empty and ready for new calibrations
SELECT * FROM plan_calibrations;
