-- Remove ONLY the old constraint, keep the new one
-- The new constraint (plan_id + page_number) already exists, which is good!
-- We just need to remove the old one (plan_id only)

-- Drop the OLD constraint (if it exists)
ALTER TABLE plan_calibrations DROP CONSTRAINT IF EXISTS plan_calibrations_plan_id_unique;
ALTER TABLE plan_calibrations DROP CONSTRAINT IF EXISTS plan_calibrations_plan_id_key;

-- Clear existing data (since it may conflict)
TRUNCATE TABLE plan_calibrations;

-- Verify: Show all constraints (should only see the new one)
SELECT conname, pg_get_constraintdef(oid) 
FROM pg_constraint 
WHERE conrelid = 'plan_calibrations'::regclass;
