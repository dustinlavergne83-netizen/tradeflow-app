-- ================================================================
-- REORGANIZE EMT STRAP IDs FOR BETTER SEARCHABILITY
-- ================================================================
-- OLD PATTERN: emt12_usclamp, emt12_1hole, emt12_2hole, emt12_strap
-- NEW PATTERN: emt12_strap_uni, emt12_strap_1h, emt12_strap_2h, emt12_strap_std
-- ================================================================
-- Benefits of new pattern:
--   - Search "emt12_strap" to find ALL straps for 1/2"
--   - Search "_strap_uni" to find ALL unistrut straps across all sizes
--   - Search "_strap_1h" to find ALL 1-hole straps
--   - Search "_strap_2h" to find ALL 2-hole straps
-- ================================================================

-- ================================================================
-- STEP 1: CHECK what will be migrated
-- ================================================================
SELECT 
  'EMT Straps to be Reorganized' as status,
  id as current_id,
  name,
  CASE
    -- Unistrut straps
    WHEN id LIKE '%_usclamp' THEN REPLACE(id, '_usclamp', '_strap_uni')
    -- 1-hole straps
    WHEN id LIKE '%_1hole' THEN REPLACE(id, '_1hole', '_strap_1h')
    -- 2-hole straps
    WHEN id LIKE '%_2hole' THEN REPLACE(id, '_2hole', '_strap_2h')
    -- Standard/generic straps (but not standoff)
    WHEN id LIKE 'emt%_strap' AND id NOT LIKE '%_strap_%' THEN REPLACE(id, '_strap', '_strap_std')
    ELSE id
  END as new_id
FROM base_materials
WHERE id LIKE 'emt%'
  AND (id LIKE '%_usclamp' OR id LIKE '%_1hole' OR id LIKE '%_2hole' OR id LIKE '%_strap')
  AND id NOT LIKE '%_standoff'
  AND id NOT LIKE '%_strap_%'  -- Don't match already converted ones
ORDER BY id;

-- ================================================================
-- STEP 2: MIGRATION - Reorganize all EMT strap IDs
-- ================================================================

BEGIN;

-- Update Unistrut Straps: _usclamp → _strap_uni
UPDATE base_materials 
SET id = REPLACE(id, '_usclamp', '_strap_uni')
WHERE id LIKE 'emt%_usclamp';

-- Update 1-Hole Straps: _1hole → _strap_1h
UPDATE base_materials 
SET id = REPLACE(id, '_1hole', '_strap_1h')
WHERE id LIKE 'emt%_1hole';

-- Update 2-Hole Straps: _2hole → _strap_2h
UPDATE base_materials 
SET id = REPLACE(id, '_2hole', '_strap_2h')
WHERE id LIKE 'emt%_2hole';

-- Update Standard Straps: _strap → _strap_std (only those not already converted)
UPDATE base_materials 
SET id = REPLACE(id, '_strap', '_strap_std')
WHERE id LIKE 'emt%_strap' 
  AND id NOT LIKE '%_strap_%'
  AND id NOT LIKE '%_standoff';

COMMIT;

-- ================================================================
-- STEP 3: VERIFY the migration
-- ================================================================

-- Show all reorganized straps by type
SELECT 
  'EMT Unistrut Straps' as category,
  id,
  name,
  basecost,
  laborhours
FROM base_materials
WHERE id LIKE 'emt%_strap_uni'
ORDER BY id;

SELECT 
  'EMT 1-Hole Straps' as category,
  id,
  name,
  basecost,
  laborhours
FROM base_materials
WHERE id LIKE 'emt%_strap_1h'
ORDER BY id;

SELECT 
  'EMT 2-Hole Straps' as category,
  id,
  name,
  basecost,
  laborhours
FROM base_materials
WHERE id LIKE 'emt%_strap_2h'
ORDER BY id;

SELECT 
  'EMT Standard Straps' as category,
  id,
  name,
  basecost,
  laborhours
FROM base_materials
WHERE id LIKE 'emt%_strap_std'
ORDER BY id;

-- Count by type
SELECT 
  'Summary' as info,
  COUNT(*) FILTER (WHERE id LIKE '%_strap_uni') as unistrut_straps,
  COUNT(*) FILTER (WHERE id LIKE '%_strap_1h') as one_hole_straps,
  COUNT(*) FILTER (WHERE id LIKE '%_strap_2h') as two_hole_straps,
  COUNT(*) FILTER (WHERE id LIKE '%_strap_std') as standard_straps,
  COUNT(*) FILTER (WHERE id LIKE '%_strap_%') as total_straps
FROM base_materials
WHERE id LIKE 'emt%';

-- ================================================================
-- STEP 4: Check for any old pattern stragglers
-- ================================================================
SELECT 
  'OLD PATTERN STILL EXISTS (Should be empty)' as warning,
  id,
  name
FROM base_materials
WHERE id LIKE 'emt%'
  AND (id LIKE '%_usclamp' OR id LIKE '%_1hole' OR id LIKE '%_2hole')
ORDER BY id;

-- Also check for unconverted _strap entries (should only be standoff if any)
SELECT 
  'Unconverted _strap entries (should only be standoff)' as info,
  id,
  name
FROM base_materials
WHERE id LIKE 'emt%_strap'
  AND id NOT LIKE '%_strap_%'
ORDER BY id;
