-- Quick fix: Drop old constraint and add the correct one
-- Run this in Supabase SQL Editor RIGHT NOW

-- Drop ALL existing unique constraints on plan_calibrations
ALTER TABLE plan_calibrations
DROP CONSTRAINT IF EXISTS plan_calibrations_plan_id_unique;

ALTER TABLE plan_calibrations
DROP CONSTRAINT IF EXISTS plan_calibrations_plan_id_key;

-- Add the CORRECT constraint (plan_id + page_number together)
ALTER TABLE plan_calibrations
ADD CONSTRAINT plan_calibrations_plan_id_page_number_key 
UNIQUE (plan_id, page_number);

-- Verify it worked
SELECT 
    conname AS constraint_name,
    pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = 'plan_calibrations'::regclass
AND contype = 'u';
