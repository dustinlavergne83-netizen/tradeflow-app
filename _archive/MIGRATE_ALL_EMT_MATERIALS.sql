-- ================================================================
-- MIGRATION: ALL EMT Materials to Simplified Pattern
-- ================================================================
-- This will rename ALL EMT materials (all sizes) to follow pattern:
-- emt05, emt075, emt1, emt125, emt15, emt2, emt25, emt3, emt35, emt4
-- with components: _90, _45, _ssconn, _cpconn, _sscpl, _cpcpl, etc.
-- ================================================================

-- ================================================================
-- STEP 1: CHECK all EMT materials across all sizes
-- ================================================================
SELECT 
  'Current EMT Materials - All Sizes' as status,
  id as current_id,
  name,
  CASE 
    -- Check compound sizes FIRST (before simple sizes)
    WHEN name ILIKE '%1-1/4%' OR name ILIKE '%1 1/4%' THEN '125'
    WHEN name ILIKE '%1-1/2%' OR name ILIKE '%1 1/2%' THEN '15'
    WHEN name ILIKE '%2-1/2%' OR name ILIKE '%2 1/2%' THEN '25'
    WHEN name ILIKE '%3-1/2%' OR name ILIKE '%3 1/2%' THEN '35'
    -- Then simple sizes
    WHEN name ILIKE '%1/2%' THEN '05'
    WHEN name ILIKE '%3/4%' THEN '075'
    WHEN name ~ '1"' AND name NOT ILIKE '%1/4%' AND name NOT ILIKE '%1/2%' THEN '1'
    WHEN name ~ '2"' AND name NOT ILIKE '%1/2%' THEN '2'
    WHEN name ~ '3"' AND name NOT ILIKE '%1/2%' THEN '3'
    WHEN name ~ '4"' THEN '4'
    ELSE 'unknown'
  END as size_code,
  CASE
    WHEN name ILIKE '%conduit%' AND name NOT ILIKE '%fitting%' AND name NOT ILIKE '%connector%' 
         AND name NOT ILIKE '%coupling%' AND name NOT ILIKE '%elbow%' THEN ''
    WHEN name ILIKE '%90%' OR (name ILIKE '%elbow%' AND name NOT ILIKE '%45%') THEN '_90'
    WHEN name ILIKE '%45%' THEN '_45'
    WHEN name ILIKE '%connector%' AND name ILIKE '%set%screw%' THEN '_ssconn'
    WHEN name ILIKE '%connector%' AND name ILIKE '%compression%' THEN '_cpconn'
    WHEN name ILIKE '%connector%' THEN '_ssconn'
    WHEN name ILIKE '%coupling%' AND name ILIKE '%set%screw%' THEN '_sscpl'
    WHEN name ILIKE '%coupling%' AND name ILIKE '%compression%' THEN '_cpcpl'
    WHEN name ILIKE '%coupling%' THEN '_sscpl'
    WHEN name ILIKE '%LB%' THEN '_lb'
    WHEN name ILIKE '%LL%' THEN '_ll'
    WHEN name ILIKE '%LR%' THEN '_lr'
    WHEN name ILIKE '%T%body%' THEN '_t'
    WHEN name ILIKE '%C%body%' THEN '_c'
    WHEN name ILIKE '%strap%' OR name ILIKE '%clamp%' THEN '_strap'
    WHEN name ILIKE '%bushing%' THEN '_bushing'
    WHEN name ILIKE '%offset%' THEN '_offset'
    ELSE '_other'
  END as component_suffix,
  category,
  basecost,
  laborhours
FROM base_materials
WHERE name ILIKE '%EMT%'
ORDER BY 
  CASE 
    WHEN name ILIKE '%1/2%' THEN 1
    WHEN name ILIKE '%3/4%' THEN 2
    WHEN name ILIKE '%1"%' OR name ~ '^1" ' THEN 3
    WHEN name ILIKE '%1-1/4%' THEN 4
    WHEN name ILIKE '%1-1/2%' THEN 5
    WHEN name ILIKE '%2"%' OR name ~ '^2" ' THEN 6
    WHEN name ILIKE '%2-1/2%' THEN 7
    WHEN name ILIKE '%3"%' OR name ~ '^3" ' THEN 8
    WHEN name ILIKE '%3-1/2%' THEN 9
    WHEN name ILIKE '%4"%' THEN 10
    ELSE 99
  END,
  name;

-- ================================================================
-- STEP 2: CHECK for ID conflicts
-- ================================================================
SELECT 
  'Potential ID Conflicts' as check_type,
  id,
  name
FROM base_materials
WHERE id ~ '^emt[0-9]+' OR id ~ '^emt[0-9]+_';

-- ================================================================
-- STEP 3: MIGRATION SCRIPT FOR ALL EMT SIZES
-- ================================================================
-- IMPORTANT: Review above queries before running!

BEGIN;

-- ================================================================
-- 1/2" EMT (emt05)
-- ================================================================
UPDATE base_materials SET id = 'emt05' 
WHERE name ILIKE '%1/2%' AND name ILIKE '%EMT%' AND name ILIKE '%conduit%' 
  AND name NOT ILIKE '%fitting%' AND name NOT ILIKE '%connector%' AND name NOT ILIKE '%coupling%' AND name NOT ILIKE '%elbow%';

UPDATE base_materials SET id = 'emt05_90' 
WHERE name ILIKE '%1/2%' AND name ILIKE '%EMT%' AND (name ILIKE '%90%' OR (name ILIKE '%elbow%' AND name NOT ILIKE '%45%'));

UPDATE base_materials SET id = 'emt05_45' 
WHERE name ILIKE '%1/2%' AND name ILIKE '%EMT%' AND name ILIKE '%45%';

UPDATE base_materials SET id = 'emt05_ssconn' 
WHERE name ILIKE '%1/2%' AND name ILIKE '%EMT%' AND name ILIKE '%connector%' 
  AND (name ILIKE '%set%screw%' OR name NOT ILIKE '%compression%');

UPDATE base_materials SET id = 'emt05_cpconn' 
WHERE name ILIKE '%1/2%' AND name ILIKE '%EMT%' AND name ILIKE '%connector%' AND name ILIKE '%compression%';

UPDATE base_materials SET id = 'emt05_sscpl' 
WHERE name ILIKE '%1/2%' AND name ILIKE '%EMT%' AND name ILIKE '%coupling%' 
  AND (name ILIKE '%set%screw%' OR name NOT ILIKE '%compression%') AND name NOT ILIKE '%connector%';

UPDATE base_materials SET id = 'emt05_cpcpl' 
WHERE name ILIKE '%1/2%' AND name ILIKE '%EMT%' AND name ILIKE '%coupling%' AND name ILIKE '%compression%' AND name NOT ILIKE '%connector%';

UPDATE base_materials SET id = 'emt05_lb' WHERE name ILIKE '%1/2%' AND name ILIKE '%EMT%' AND name ILIKE '%LB%';
UPDATE base_materials SET id = 'emt05_ll' WHERE name ILIKE '%1/2%' AND name ILIKE '%EMT%' AND name ILIKE '%LL%';
UPDATE base_materials SET id = 'emt05_lr' WHERE name ILIKE '%1/2%' AND name ILIKE '%EMT%' AND name ILIKE '%LR%';
UPDATE base_materials SET id = 'emt05_t' WHERE name ILIKE '%1/2%' AND name ILIKE '%EMT%' AND name ILIKE '%T%body%';
UPDATE base_materials SET id = 'emt05_c' WHERE name ILIKE '%1/2%' AND name ILIKE '%EMT%' AND name ILIKE '%C%body%';
UPDATE base_materials SET id = 'emt05_strap' WHERE name ILIKE '%1/2%' AND name ILIKE '%EMT%' AND (name ILIKE '%strap%' OR name ILIKE '%clamp%');
UPDATE base_materials SET id = 'emt05_bushing' WHERE name ILIKE '%1/2%' AND name ILIKE '%EMT%' AND name ILIKE '%bushing%';
UPDATE base_materials SET id = 'emt05_offset' WHERE name ILIKE '%1/2%' AND name ILIKE '%EMT%' AND name ILIKE '%offset%';

-- ================================================================
-- 3/4" EMT (emt075)
-- ================================================================
UPDATE base_materials SET id = 'emt075' 
WHERE name ILIKE '%3/4%' AND name ILIKE '%EMT%' AND name ILIKE '%conduit%' 
  AND name NOT ILIKE '%fitting%' AND name NOT ILIKE '%connector%' AND name NOT ILIKE '%coupling%' AND name NOT ILIKE '%elbow%';

UPDATE base_materials SET id = 'emt075_90' 
WHERE name ILIKE '%3/4%' AND name ILIKE '%EMT%' AND (name ILIKE '%90%' OR (name ILIKE '%elbow%' AND name NOT ILIKE '%45%'));

UPDATE base_materials SET id = 'emt075_45' 
WHERE name ILIKE '%3/4%' AND name ILIKE '%EMT%' AND name ILIKE '%45%';

UPDATE base_materials SET id = 'emt075_ssconn' 
WHERE name ILIKE '%3/4%' AND name ILIKE '%EMT%' AND name ILIKE '%connector%' 
  AND (name ILIKE '%set%screw%' OR name NOT ILIKE '%compression%');

UPDATE base_materials SET id = 'emt075_cpconn' 
WHERE name ILIKE '%3/4%' AND name ILIKE '%EMT%' AND name ILIKE '%connector%' AND name ILIKE '%compression%';

UPDATE base_materials SET id = 'emt075_sscpl' 
WHERE name ILIKE '%3/4%' AND name ILIKE '%EMT%' AND name ILIKE '%coupling%' 
  AND (name ILIKE '%set%screw%' OR name NOT ILIKE '%compression%') AND name NOT ILIKE '%connector%';

UPDATE base_materials SET id = 'emt075_cpcpl' 
WHERE name ILIKE '%3/4%' AND name ILIKE '%EMT%' AND name ILIKE '%coupling%' AND name ILIKE '%compression%' AND name NOT ILIKE '%connector%';

UPDATE base_materials SET id = 'emt075_lb' WHERE name ILIKE '%3/4%' AND name ILIKE '%EMT%' AND name ILIKE '%LB%';
UPDATE base_materials SET id = 'emt075_ll' WHERE name ILIKE '%3/4%' AND name ILIKE '%EMT%' AND name ILIKE '%LL%';
UPDATE base_materials SET id = 'emt075_lr' WHERE name ILIKE '%3/4%' AND name ILIKE '%EMT%' AND name ILIKE '%LR%';
UPDATE base_materials SET id = 'emt075_t' WHERE name ILIKE '%3/4%' AND name ILIKE '%EMT%' AND name ILIKE '%T%body%';
UPDATE base_materials SET id = 'emt075_c' WHERE name ILIKE '%3/4%' AND name ILIKE '%EMT%' AND name ILIKE '%C%body%';
UPDATE base_materials SET id = 'emt075_strap' WHERE name ILIKE '%3/4%' AND name ILIKE '%EMT%' AND (name ILIKE '%strap%' OR name ILIKE '%clamp%');
UPDATE base_materials SET id = 'emt075_bushing' WHERE name ILIKE '%3/4%' AND name ILIKE '%EMT%' AND name ILIKE '%bushing%';

-- ================================================================
-- 1" EMT (emt1)
-- ================================================================
UPDATE base_materials SET id = 'emt1' 
WHERE name ~ '1" EMT' AND name NOT ILIKE '%1/4%' AND name NOT ILIKE '%1/2%'
  AND name ILIKE '%conduit%' AND name NOT ILIKE '%fitting%' AND name NOT ILIKE '%connector%' 
  AND name NOT ILIKE '%coupling%' AND name NOT ILIKE '%elbow%';

UPDATE base_materials SET id = 'emt1_90' 
WHERE name ~ '1" EMT' AND name NOT ILIKE '%1/4%' AND name NOT ILIKE '%1/2%'
  AND (name ILIKE '%90%' OR (name ILIKE '%elbow%' AND name NOT ILIKE '%45%'));

UPDATE base_materials SET id = 'emt1_45' 
WHERE name ~ '1" EMT' AND name NOT ILIKE '%1/4%' AND name NOT ILIKE '%1/2%' AND name ILIKE '%45%';

UPDATE base_materials SET id = 'emt1_ssconn' 
WHERE name ~ '1" EMT' AND name NOT ILIKE '%1/4%' AND name NOT ILIKE '%1/2%'
  AND name ILIKE '%connector%' AND (name ILIKE '%set%screw%' OR name NOT ILIKE '%compression%');

UPDATE base_materials SET id = 'emt1_cpconn' 
WHERE name ~ '1" EMT' AND name NOT ILIKE '%1/4%' AND name NOT ILIKE '%1/2%'
  AND name ILIKE '%connector%' AND name ILIKE '%compression%';

UPDATE base_materials SET id = 'emt1_sscpl' 
WHERE name ~ '1" EMT' AND name NOT ILIKE '%1/4%' AND name NOT ILIKE '%1/2%'
  AND name ILIKE '%coupling%' AND (name ILIKE '%set%screw%' OR name NOT ILIKE '%compression%') AND name NOT ILIKE '%connector%';

UPDATE base_materials SET id = 'emt1_cpcpl' 
WHERE name ~ '1" EMT' AND name NOT ILIKE '%1/4%' AND name NOT ILIKE '%1/2%'
  AND name ILIKE '%coupling%' AND name ILIKE '%compression%' AND name NOT ILIKE '%connector%';

UPDATE base_materials SET id = 'emt1_lb' WHERE name ~ '1" EMT' AND name NOT ILIKE '%1/4%' AND name NOT ILIKE '%1/2%' AND name ILIKE '%LB%';
UPDATE base_materials SET id = 'emt1_ll' WHERE name ~ '1" EMT' AND name NOT ILIKE '%1/4%' AND name NOT ILIKE '%1/2%' AND name ILIKE '%LL%';
UPDATE base_materials SET id = 'emt1_lr' WHERE name ~ '1" EMT' AND name NOT ILIKE '%1/4%' AND name NOT ILIKE '%1/2%' AND name ILIKE '%LR%';
UPDATE base_materials SET id = 'emt1_strap' WHERE name ~ '1" EMT' AND name NOT ILIKE '%1/4%' AND name NOT ILIKE '%1/2%' AND (name ILIKE '%strap%' OR name ILIKE '%clamp%');

-- ================================================================
-- 1-1/4" EMT (emt125)
-- ================================================================
UPDATE base_materials SET id = 'emt125' 
WHERE (name ILIKE '%1-1/4%' OR name ILIKE '%1 1/4%') AND name ILIKE '%EMT%' 
  AND name ILIKE '%conduit%' AND name NOT ILIKE '%fitting%' AND name NOT ILIKE '%connector%' 
  AND name NOT ILIKE '%coupling%' AND name NOT ILIKE '%elbow%';

UPDATE base_materials SET id = 'emt125_90' 
WHERE (name ILIKE '%1-1/4%' OR name ILIKE '%1 1/4%') AND name ILIKE '%EMT%' 
  AND (name ILIKE '%90%' OR (name ILIKE '%elbow%' AND name NOT ILIKE '%45%'));

UPDATE base_materials SET id = 'emt125_45' 
WHERE (name ILIKE '%1-1/4%' OR name ILIKE '%1 1/4%') AND name ILIKE '%EMT%' AND name ILIKE '%45%';

UPDATE base_materials SET id = 'emt125_ssconn' 
WHERE (name ILIKE '%1-1/4%' OR name ILIKE '%1 1/4%') AND name ILIKE '%EMT%' 
  AND name ILIKE '%connector%' AND (name ILIKE '%set%screw%' OR name NOT ILIKE '%compression%');

UPDATE base_materials SET id = 'emt125_cpconn' 
WHERE (name ILIKE '%1-1/4%' OR name ILIKE '%1 1/4%') AND name ILIKE '%EMT%' 
  AND name ILIKE '%connector%' AND name ILIKE '%compression%';

UPDATE base_materials SET id = 'emt125_sscpl' 
WHERE (name ILIKE '%1-1/4%' OR name ILIKE '%1 1/4%') AND name ILIKE '%EMT%' 
  AND name ILIKE '%coupling%' AND (name ILIKE '%set%screw%' OR name NOT ILIKE '%compression%') AND name NOT ILIKE '%connector%';

UPDATE base_materials SET id = 'emt125_strap' 
WHERE (name ILIKE '%1-1/4%' OR name ILIKE '%1 1/4%') AND name ILIKE '%EMT%' AND (name ILIKE '%strap%' OR name ILIKE '%clamp%');

-- ================================================================
-- 1-1/2" EMT (emt15)
-- ================================================================
UPDATE base_materials SET id = 'emt15' 
WHERE (name ILIKE '%1-1/2%' OR name ILIKE '%1 1/2%') AND name ILIKE '%EMT%' 
  AND name ILIKE '%conduit%' AND name NOT ILIKE '%fitting%' AND name NOT ILIKE '%connector%' 
  AND name NOT ILIKE '%coupling%' AND name NOT ILIKE '%elbow%';

UPDATE base_materials SET id = 'emt15_90' 
WHERE (name ILIKE '%1-1/2%' OR name ILIKE '%1 1/2%') AND name ILIKE '%EMT%' 
  AND (name ILIKE '%90%' OR (name ILIKE '%elbow%' AND name NOT ILIKE '%45%'));

UPDATE base_materials SET id = 'emt15_45' 
WHERE (name ILIKE '%1-1/2%' OR name ILIKE '%1 1/2%') AND name ILIKE '%EMT%' AND name ILIKE '%45%';

UPDATE base_materials SET id = 'emt15_ssconn' 
WHERE (name ILIKE '%1-1/2%' OR name ILIKE '%1 1/2%') AND name ILIKE '%EMT%' 
  AND name ILIKE '%connector%' AND (name ILIKE '%set%screw%' OR name NOT ILIKE '%compression%');

UPDATE base_materials SET id = 'emt15_cpconn' 
WHERE (name ILIKE '%1-1/2%' OR name ILIKE '%1 1/2%') AND name ILIKE '%EMT%' 
  AND name ILIKE '%connector%' AND name ILIKE '%compression%';

UPDATE base_materials SET id = 'emt15_sscpl' 
WHERE (name ILIKE '%1-1/2%' OR name ILIKE '%1 1/2%') AND name ILIKE '%EMT%' 
  AND name ILIKE '%coupling%' AND (name ILIKE '%set%screw%' OR name NOT ILIKE '%compression%') AND name NOT ILIKE '%connector%';

UPDATE base_materials SET id = 'emt15_strap' 
WHERE (name ILIKE '%1-1/2%' OR name ILIKE '%1 1/2%') AND name ILIKE '%EMT%' AND (name ILIKE '%strap%' OR name ILIKE '%clamp%');

-- ================================================================
-- 2" EMT (emt2)
-- ================================================================
UPDATE base_materials SET id = 'emt2' 
WHERE name ~ '2" EMT' AND name NOT ILIKE '%1/2%' 
  AND name ILIKE '%conduit%' AND name NOT ILIKE '%fitting%' AND name NOT ILIKE '%connector%' 
  AND name NOT ILIKE '%coupling%' AND name NOT ILIKE '%elbow%';

UPDATE base_materials SET id = 'emt2_90' 
WHERE name ~ '2" EMT' AND name NOT ILIKE '%1/2%' 
  AND (name ILIKE '%90%' OR (name ILIKE '%elbow%' AND name NOT ILIKE '%45%'));

UPDATE base_materials SET id = 'emt2_45' 
WHERE name ~ '2" EMT' AND name NOT ILIKE '%1/2%' AND name ILIKE '%45%';

UPDATE base_materials SET id = 'emt2_ssconn' 
WHERE name ~ '2" EMT' AND name NOT ILIKE '%1/2%' 
  AND name ILIKE '%connector%' AND (name ILIKE '%set%screw%' OR name NOT ILIKE '%compression%');

UPDATE base_materials SET id = 'emt2_cpconn' 
WHERE name ~ '2" EMT' AND name NOT ILIKE '%1/2%' 
  AND name ILIKE '%connector%' AND name ILIKE '%compression%';

UPDATE base_materials SET id = 'emt2_sscpl' 
WHERE name ~ '2" EMT' AND name NOT ILIKE '%1/2%' 
  AND name ILIKE '%coupling%' AND (name ILIKE '%set%screw%' OR name NOT ILIKE '%compression%') AND name NOT ILIKE '%connector%';

UPDATE base_materials SET id = 'emt2_strap' 
WHERE name ~ '2" EMT' AND name NOT ILIKE '%1/2%' AND (name ILIKE '%strap%' OR name ILIKE '%clamp%');

-- ================================================================
-- 2-1/2" EMT (emt25)
-- ================================================================
UPDATE base_materials SET id = 'emt25' 
WHERE (name ILIKE '%2-1/2%' OR name ILIKE '%2 1/2%') AND name ILIKE '%EMT%' 
  AND name ILIKE '%conduit%' AND name NOT ILIKE '%fitting%' AND name NOT ILIKE '%connector%' 
  AND name NOT ILIKE '%coupling%' AND name NOT ILIKE '%elbow%';

UPDATE base_materials SET id = 'emt25_90' 
WHERE (name ILIKE '%2-1/2%' OR name ILIKE '%2 1/2%') AND name ILIKE '%EMT%' 
  AND (name ILIKE '%90%' OR (name ILIKE '%elbow%' AND name NOT ILIKE '%45%'));

UPDATE base_materials SET id = 'emt25_strap' 
WHERE (name ILIKE '%2-1/2%' OR name ILIKE '%2 1/2%') AND name ILIKE '%EMT%' AND (name ILIKE '%strap%' OR name ILIKE '%clamp%');

-- ================================================================
-- 3" EMT (emt3)
-- ================================================================
UPDATE base_materials SET id = 'emt3' 
WHERE name ~ '3" EMT' AND name NOT ILIKE '%1/2%' 
  AND name ILIKE '%conduit%' AND name NOT ILIKE '%fitting%' AND name NOT ILIKE '%connector%' 
  AND name NOT ILIKE '%coupling%' AND name NOT ILIKE '%elbow%';

UPDATE base_materials SET id = 'emt3_90' 
WHERE name ~ '3" EMT' AND name NOT ILIKE '%1/2%' 
  AND (name ILIKE '%90%' OR (name ILIKE '%elbow%' AND name NOT ILIKE '%45%'));

UPDATE base_materials SET id = 'emt3_strap' 
WHERE name ~ '3" EMT' AND name NOT ILIKE '%1/2%' AND (name ILIKE '%strap%' OR name ILIKE '%clamp%');

-- ================================================================
-- 3-1/2" EMT (emt35)
-- ================================================================
UPDATE base_materials SET id = 'emt35' 
WHERE (name ILIKE '%3-1/2%' OR name ILIKE '%3 1/2%') AND name ILIKE '%EMT%' 
  AND name ILIKE '%conduit%' AND name NOT ILIKE '%fitting%' AND name NOT ILIKE '%connector%' 
  AND name NOT ILIKE '%coupling%' AND name NOT ILIKE '%elbow%';

UPDATE base_materials SET id = 'emt35_90' 
WHERE (name ILIKE '%3-1/2%' OR name ILIKE '%3 1/2%') AND name ILIKE '%EMT%' 
  AND (name ILIKE '%90%' OR (name ILIKE '%elbow%' AND name NOT ILIKE '%45%'));

-- ================================================================
-- 4" EMT (emt4)
-- ================================================================
UPDATE base_materials SET id = 'emt4' 
WHERE name ~ '4" EMT' 
  AND name ILIKE '%conduit%' AND name NOT ILIKE '%fitting%' AND name NOT ILIKE '%connector%' 
  AND name NOT ILIKE '%coupling%' AND name NOT ILIKE '%elbow%';

UPDATE base_materials SET id = 'emt4_90' 
WHERE name ~ '4" EMT' 
  AND (name ILIKE '%90%' OR (name ILIKE '%elbow%' AND name NOT ILIKE '%45%'));

UPDATE base_materials SET id = 'emt4_strap' 
WHERE name ~ '4" EMT' AND (name ILIKE '%strap%' OR name ILIKE '%clamp%');

COMMIT;
-- Or ROLLBACK if there are issues

-- ================================================================
-- STEP 4: VERIFY after migration
-- ================================================================

SELECT 
  'All EMT Materials After Migration' as status,
  id,
  name,
  category
FROM base_materials
WHERE id LIKE 'emt%'
ORDER BY 
  CASE 
    WHEN id LIKE 'emt05%' THEN 1
    WHEN id LIKE 'emt075%' THEN 2
    WHEN id LIKE 'emt1%' AND id NOT LIKE 'emt15%' AND id NOT LIKE 'emt125%' THEN 3
    WHEN id LIKE 'emt125%' THEN 4
    WHEN id LIKE 'emt15%' THEN 5
    WHEN id LIKE 'emt2%' AND id NOT LIKE 'emt25%' THEN 6
    WHEN id LIKE 'emt25%' THEN 7
    WHEN id LIKE 'emt3%' AND id NOT LIKE 'emt35%' THEN 8
    WHEN id LIKE 'emt35%' THEN 9
    WHEN id LIKE 'emt4%' THEN 10
  END,
  id;
