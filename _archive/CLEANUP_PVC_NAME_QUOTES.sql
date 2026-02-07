-- ================================================================
-- CLEANUP PVC MATERIAL NAMES - Remove Extra Quotation Marks
-- ================================================================
-- Fixes names like "1"" PVC 90° Elbow" to "1 inch PVC 90° Elbow"
-- ================================================================

-- ================================================================
-- STEP 1: PREVIEW - Show what will be changed
-- ================================================================

SELECT 
  'PVC Names That Will Be Cleaned' as status,
  id,
  name as current_name,
  REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
    name,
    '"1/2""', '1/2"'),
    '"3/4""', '3/4"'),
    '"1""', '1"'),
    '"1-1/4""', '1-1/4"'),
    '"1-1/2""', '1-1/2"'),
    '"2""', '2"'),
    '"2-1/2""', '2-1/2"'),
    '"3""', '3"'),
    '"4""', '4"'
  ) as cleaned_name
FROM base_materials
WHERE name LIKE '%""%'
ORDER BY id;

-- ================================================================
-- STEP 2: EXECUTE - Clean up the names
-- ================================================================

BEGIN;

-- Replace all the double-quoted sizes with single-quoted sizes
UPDATE base_materials
SET name = REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
    name,
    '"1/2""', '1/2"'),
    '"3/4""', '3/4"'),
    '"1""', '1"'),
    '"1-1/4""', '1-1/4"'),
    '"1-1/2""', '1-1/2"'),
    '"2""', '2"'),
    '"2-1/2""', '2-1/2"'),
    '"3""', '3"'),
    '"4""', '4"'
  )
WHERE name LIKE '%""%';

COMMIT;

-- ================================================================
-- STEP 3: VERIFY - Check that names are cleaned
-- ================================================================

-- Show sample of cleaned names
SELECT 
  'Cleaned PVC Names (Sample)' as status,
  id,
  name,
  category
FROM base_materials
WHERE id LIKE 'pvc%'
ORDER BY id
LIMIT 30;

-- Check if any double quotes remain
SELECT 
  'Names Still With Double Quotes (Should be empty)' as warning,
  id,
  name
FROM base_materials
WHERE name LIKE '%""%'
ORDER BY id;

-- ================================================================
-- CLEANUP COMPLETE
-- ================================================================
SELECT '✅ PVC Material Names Cleaned!' as status;
