-- DELETE ALL DUPLICATE ITEMS FROM ESTIMATE #1005
-- This will remove duplicate entries permanently

-- First, let's see what we have
SELECT 
  description,
  COUNT(*) as count,
  array_agg(id) as ids
FROM estimate_items
WHERE estimate_id = '9e399f51-24d7-4d03-b891-34c96c7259aa'
  AND parent_id IS NULL
GROUP BY description, quantity, section
HAVING COUNT(*) > 1;

-- Now DELETE duplicates, keeping only the FIRST occurrence
DELETE FROM estimate_items
WHERE id IN (
  SELECT id
  FROM (
    SELECT id,
           ROW_NUMBER() OVER (PARTITION BY description, quantity, section ORDER BY created_at) as rn
    FROM estimate_items
    WHERE estimate_id = '9e399f51-24d7-4d03-b891-34c96c7259aa'
      AND parent_id IS NULL
  ) t
  WHERE rn > 1
);

-- Verify - should return 0 rows
SELECT 
  description,
  COUNT(*) as count
FROM estimate_items
WHERE estimate_id = '9e399f51-24d7-4d03-b891-34c96c7259aa'
  AND parent_id IS NULL
GROUP BY description, quantity, section
HAVING COUNT(*) > 1;

-- Show final count
SELECT COUNT(*) as remaining_items
FROM estimate_items
WHERE estimate_id = '9e399f51-24d7-4d03-b891-34c96c7259aa'
  AND parent_id IS NULL;
