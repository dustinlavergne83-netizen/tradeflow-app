-- ================================================================
-- RENAME UNISTRUT STRAPS TO USCLAMP
-- ================================================================
-- Changes: emt*_strap (for Unistrut items) → emt*_usclamp
-- This distinguishes Unistrut clamps from regular straps
-- ================================================================

-- Preview what will be changed
SELECT 
  'Unistrut Straps to Rename' as preview,
  id as current_id,
  REPLACE(id, '_strap', '_usclamp') as new_id,
  name
FROM base_materials
WHERE id LIKE 'emt%_strap'
  AND name ILIKE '%unistrut%'
ORDER BY id;

-- Actual rename (uncomment to execute)
/*
BEGIN;

-- 1/2" Unistrut
UPDATE base_materials SET id = 'emt12_usclamp'
WHERE id = 'emt12_strap' AND name ILIKE '%unistrut%';

-- 3/4" Unistrut
UPDATE base_materials SET id = 'emt34_usclamp'
WHERE id = 'emt34_strap' AND name ILIKE '%unistrut%';

-- 1" Unistrut
UPDATE base_materials SET id = 'emt1_usclamp'
WHERE id = 'emt1_strap' AND name ILIKE '%unistrut%';

-- 1-1/4" Unistrut
UPDATE base_materials SET id = 'emt114_usclamp'
WHERE id = 'emt114_strap' AND name ILIKE '%unistrut%';

-- 1-1/2" Unistrut
UPDATE base_materials SET id = 'emt112_usclamp'
WHERE id = 'emt112_strap' AND name ILIKE '%unistrut%';

-- 2" Unistrut
UPDATE base_materials SET id = 'emt2_usclamp'
WHERE id = 'emt2_strap' AND name ILIKE '%unistrut%';

-- 2-1/2" Unistrut
UPDATE base_materials SET id = 'emt212_usclamp'
WHERE id = 'emt212_strap' AND name ILIKE '%unistrut%';

-- 3" Unistrut
UPDATE base_materials SET id = 'emt3_usclamp'
WHERE id = 'emt3_strap' AND name ILIKE '%unistrut%';

-- 4" Unistrut
UPDATE base_materials SET id = 'emt4_usclamp'
WHERE id = 'emt4_strap' AND name ILIKE '%unistrut%';

COMMIT;

-- Verify the changes
SELECT 
  'Renamed Unistrut Clamps' as status,
  id,
  name
FROM base_materials
WHERE id LIKE 'emt%_usclamp'
ORDER BY id;
*/
