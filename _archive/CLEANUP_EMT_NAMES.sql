-- ================================================================
-- CLEANUP EMT MATERIAL NAMES - Remove Extra Quotes
-- ================================================================
-- Removes the doubled quotation marks from material names
-- Changes: 1"" EMT → 1" EMT
-- ================================================================

BEGIN;

UPDATE base_materials
SET name = REPLACE(REPLACE(name, '""', '"'), '���', '°')
WHERE id LIKE 'emt%' 
  AND (name LIKE '%""%' OR name LIKE '%���%');

-- Verify the changes
SELECT 
  'Cleaned Material Names' as status,
  id,
  name
FROM base_materials
WHERE id LIKE 'emt%'
ORDER BY id
LIMIT 20;

COMMIT;
