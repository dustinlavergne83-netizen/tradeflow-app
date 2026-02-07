-- FINAL FIX: Drop ALL possible constraint variations and start fresh

-- Drop every possible variation of the old constraint
ALTER TABLE plan_calibrations DROP CONSTRAINT IF EXISTS plan_calibrations_plan_id_unique;
ALTER TABLE plan_calibrations DROP CONSTRAINT IF EXISTS plan_calibrations_plan_id_key;
ALTER TABLE plan_calibrations DROP CONSTRAINT IF EXISTS plan_calibrations_pkey;

-- Clear all calibrations
TRUNCATE TABLE plan_calibrations CASCADE;

-- Add the CORRECT constraint
ALTER TABLE plan_calibrations
ADD CONSTRAINT plan_calibrations_plan_id_page_number_key 
UNIQUE (plan_id, page_number);

-- Verify: Show constraints (should only see the new one)
SELECT conname, pg_get_constraintdef(oid) 
FROM pg_constraint 
WHERE conrelid = 'plan_calibrations'::regclass;

-- Verify: Table is empty
SELECT COUNT(*) as count FROM plan_calibrations;
