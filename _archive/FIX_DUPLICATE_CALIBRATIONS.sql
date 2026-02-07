-- Fix: Remove duplicate calibrations
-- The constraint exists, but there's duplicate data violating it

-- Step 1: See what duplicates exist
SELECT plan_id, page_number, COUNT(*) as count
FROM plan_calibrations
GROUP BY plan_id, page_number
HAVING COUNT(*) > 1;

-- Step 2: Keep only the most recent calibration for each plan_id + page_number
-- Delete older duplicates
DELETE FROM plan_calibrations
WHERE id IN (
    SELECT id
    FROM (
        SELECT id,
               ROW_NUMBER() OVER (
                   PARTITION BY plan_id, page_number 
                   ORDER BY created_at DESC
               ) as rn
        FROM plan_calibrations
    ) t
    WHERE rn > 1
);

-- Step 3: Verify - should return 0 rows now
SELECT plan_id, page_number, COUNT(*) as count
FROM plan_calibrations
GROUP BY plan_id, page_number
HAVING COUNT(*) > 1;

-- Step 4: Show all calibrations (for verification)
SELECT * FROM plan_calibrations ORDER BY plan_id, page_number;
