-- ================================================================
-- MIGRATION: 1/2" EMT Materials to emt12 Pattern
-- ================================================================
-- New naming: emt12, emt12_90, emt12_45, emt12_ssconn, etc.
-- Run this FIRST before other sizes
-- ================================================================

-- ================================================================
-- STEP 1: CHECK what will be migrated
-- ================================================================
SELECT 
  '1/2 inch EMT Materials to Migrate' as status,
  id as current_id,
  name,
  basecost,
  laborhours,
  CASE
    WHEN name ILIKE '%conduit%' AND name NOT ILIKE '%fitting%' AND name NOT ILIKE '%connector%' 
         AND name NOT ILIKE '%coupling%' AND name NOT ILIKE '%elbow%' THEN 'emt12'
    WHEN name ILIKE '%90%' OR (name ILIKE '%elbow%' AND name NOT ILIKE '%45%') THEN 'emt12_90'
    WHEN name ILIKE '%45%' THEN 'emt12_45'
    WHEN name ILIKE '%connector%' AND name ILIKE '%set%screw%' THEN 'emt12_ssconn'
    WHEN name ILIKE '%connector%' AND name ILIKE '%compression%' THEN 'emt12_cpconn'
    WHEN name ILIKE '%connector%' THEN 'emt12_ssconn'
    WHEN name ILIKE '%flex%' AND name ILIKE '%coupling%' THEN 'emt12_flexcpl'
    WHEN name ILIKE '%coupling%' AND name ILIKE '%set%screw%' THEN 'emt12_sscpl'
    WHEN name ILIKE '%coupling%' AND name ILIKE '%compression%' THEN 'emt12_cpcpl'
    WHEN name ILIKE '%coupling%' THEN 'emt12_sscpl'
    WHEN name ILIKE '%LB%' THEN 'emt12_lb'
    WHEN name ILIKE '%LL%' THEN 'emt12_ll'
    WHEN name ILIKE '%LR%' THEN 'emt12_lr'
    WHEN name ILIKE '%T%body%' THEN 'emt12_t'
    WHEN name ILIKE '%C%body%' THEN 'emt12_c'
    WHEN name ILIKE '%strap%' AND name ILIKE '%1%hole%' THEN 'emt12_1hole'
    WHEN name ILIKE '%strap%' AND name ILIKE '%2%hole%' THEN 'emt12_2hole'
    WHEN name ILIKE '%strap%' OR name ILIKE '%clamp%' THEN 'emt12_strap'
    WHEN name ILIKE '%bushing%' THEN 'emt12_bushing'
    WHEN name ILIKE '%offset%' THEN 'emt12_offset'
    WHEN name ILIKE '%standoff%' THEN 'emt12_standoff'
    WHEN name ILIKE '%bender%' THEN 'emt12_bender'
    ELSE 'emt12_other'
  END as new_id
FROM base_materials
WHERE name ILIKE '%1/2%' 
  AND name NOT ILIKE '%1-1/2%' 
  AND name NOT ILIKE '%2-1/2%'
  AND name NOT ILIKE '%3-1/2%'
  AND name ILIKE '%EMT%'
  AND id NOT LIKE 'emt12%'
ORDER BY name;

-- ================================================================
-- STEP 2: MIGRATION - Rename 1/2" EMT materials
-- ================================================================

BEGIN;

-- Conduit
UPDATE base_materials SET id = 'emt12' 
WHERE name ILIKE '%1/2%' AND name NOT ILIKE '%1-1/2%' AND name NOT ILIKE '%2-1/2%' AND name NOT ILIKE '%3-1/2%'
  AND name ILIKE '%EMT%' AND name ILIKE '%conduit%' 
  AND name NOT ILIKE '%fitting%' AND name NOT ILIKE '%connector%' AND name NOT ILIKE '%coupling%' AND name NOT ILIKE '%elbow%';

-- 90 degree elbow
UPDATE base_materials SET id = 'emt12_90' 
WHERE name ILIKE '%1/2%' AND name NOT ILIKE '%1-1/2%' AND name NOT ILIKE '%2-1/2%' AND name NOT ILIKE '%3-1/2%'
  AND name ILIKE '%EMT%' AND (name ILIKE '%90%' OR (name ILIKE '%elbow%' AND name NOT ILIKE '%45%'));

-- 45 degree elbow
UPDATE base_materials SET id = 'emt12_45' 
WHERE name ILIKE '%1/2%' AND name NOT ILIKE '%1-1/2%' AND name NOT ILIKE '%2-1/2%' AND name NOT ILIKE '%3-1/2%'
  AND name ILIKE '%EMT%' AND name ILIKE '%45%';

-- Set-screw connector
UPDATE base_materials SET id = 'emt12_ssconn' 
WHERE name ILIKE '%1/2%' AND name NOT ILIKE '%1-1/2%' AND name NOT ILIKE '%2-1/2%' AND name NOT ILIKE '%3-1/2%'
  AND name ILIKE '%EMT%' AND name ILIKE '%connector%' 
  AND (name ILIKE '%set%screw%' OR (name NOT ILIKE '%compression%' AND name NOT ILIKE '%coupling%'));

-- Compression connector
UPDATE base_materials SET id = 'emt12_cpconn' 
WHERE name ILIKE '%1/2%' AND name NOT ILIKE '%1-1/2%' AND name NOT ILIKE '%2-1/2%' AND name NOT ILIKE '%3-1/2%'
  AND name ILIKE '%EMT%' AND name ILIKE '%connector%' AND name ILIKE '%compression%';

-- Flex to EMT coupling (do this FIRST before other couplings)
UPDATE base_materials SET id = 'emt12_flexcpl' 
WHERE name ILIKE '%1/2%' AND name NOT ILIKE '%1-1/2%' AND name NOT ILIKE '%2-1/2%' AND name NOT ILIKE '%3-1/2%'
  AND name ILIKE '%EMT%' AND name ILIKE '%flex%' AND name ILIKE '%coupling%';

-- Set-screw coupling (exclude flex!)
UPDATE base_materials SET id = 'emt12_sscpl' 
WHERE name ILIKE '%1/2%' AND name NOT ILIKE '%1-1/2%' AND name NOT ILIKE '%2-1/2%' AND name NOT ILIKE '%3-1/2%'
  AND name ILIKE '%EMT%' AND name ILIKE '%coupling%' 
  AND (name ILIKE '%set%screw%' OR name NOT ILIKE '%compression%') 
  AND name NOT ILIKE '%connector%'
  AND name NOT ILIKE '%flex%';

-- Compression coupling
UPDATE base_materials SET id = 'emt12_cpcpl' 
WHERE name ILIKE '%1/2%' AND name NOT ILIKE '%1-1/2%' AND name NOT ILIKE '%2-1/2%' AND name NOT ILIKE '%3-1/2%'
  AND name ILIKE '%EMT%' AND name ILIKE '%coupling%' AND name ILIKE '%compression%' AND name NOT ILIKE '%connector%';

-- LB conduit body
UPDATE base_materials SET id = 'emt12_lb' 
WHERE name ILIKE '%1/2%' AND name NOT ILIKE '%1-1/2%' AND name NOT ILIKE '%2-1/2%' AND name NOT ILIKE '%3-1/2%'
  AND name ILIKE '%EMT%' AND name ILIKE '%LB%';

-- LL conduit body
UPDATE base_materials SET id = 'emt12_ll' 
WHERE name ILIKE '%1/2%' AND name NOT ILIKE '%1-1/2%' AND name NOT ILIKE '%2-1/2%' AND name NOT ILIKE '%3-1/2%'
  AND name ILIKE '%EMT%' AND name ILIKE '%LL%';

-- LR conduit body
UPDATE base_materials SET id = 'emt12_lr' 
WHERE name ILIKE '%1/2%' AND name NOT ILIKE '%1-1/2%' AND name NOT ILIKE '%2-1/2%' AND name NOT ILIKE '%3-1/2%'
  AND name ILIKE '%EMT%' AND name ILIKE '%LR%';

-- T conduit body
UPDATE base_materials SET id = 'emt12_t' 
WHERE name ILIKE '%1/2%' AND name NOT ILIKE '%1-1/2%' AND name NOT ILIKE '%2-1/2%' AND name NOT ILIKE '%3-1/2%'
  AND name ILIKE '%EMT%' AND name ILIKE '%T%body%';

-- C conduit body
UPDATE base_materials SET id = 'emt12_c' 
WHERE name ILIKE '%1/2%' AND name NOT ILIKE '%1-1/2%' AND name NOT ILIKE '%2-1/2%' AND name NOT ILIKE '%3-1/2%'
  AND name ILIKE '%EMT%' AND name ILIKE '%C%body%';

-- 1-hole straps
UPDATE base_materials SET id = 'emt12_1hole' 
WHERE name ILIKE '%1/2%' AND name NOT ILIKE '%1-1/2%' AND name NOT ILIKE '%2-1/2%' AND name NOT ILIKE '%3-1/2%'
  AND name ILIKE '%EMT%' AND name ILIKE '%strap%' AND name ILIKE '%1%hole%' AND name NOT ILIKE '%standoff%';

-- 2-hole straps
UPDATE base_materials SET id = 'emt12_2hole' 
WHERE name ILIKE '%1/2%' AND name NOT ILIKE '%1-1/2%' AND name NOT ILIKE '%2-1/2%' AND name NOT ILIKE '%3-1/2%'
  AND name ILIKE '%EMT%' AND name ILIKE '%strap%' AND name ILIKE '%2%hole%' AND name NOT ILIKE '%standoff%';

-- Other straps/clamps (catch-all)
UPDATE base_materials SET id = 'emt12_strap' 
WHERE name ILIKE '%1/2%' AND name NOT ILIKE '%1-1/2%' AND name NOT ILIKE '%2-1/2%' AND name NOT ILIKE '%3-1/2%'
  AND name ILIKE '%EMT%' AND (name ILIKE '%strap%' OR name ILIKE '%clamp%') AND name NOT ILIKE '%standoff%';

-- Standoff straps
UPDATE base_materials SET id = 'emt12_standoff' 
WHERE name ILIKE '%1/2%' AND name NOT ILIKE '%1-1/2%' AND name NOT ILIKE '%2-1/2%' AND name NOT ILIKE '%3-1/2%'
  AND name ILIKE '%EMT%' AND name ILIKE '%standoff%';

-- Bushing
UPDATE base_materials SET id = 'emt12_bushing' 
WHERE name ILIKE '%1/2%' AND name NOT ILIKE '%1-1/2%' AND name NOT ILIKE '%2-1/2%' AND name NOT ILIKE '%3-1/2%'
  AND name ILIKE '%EMT%' AND name ILIKE '%bushing%';

-- Offset
UPDATE base_materials SET id = 'emt12_offset' 
WHERE name ILIKE '%1/2%' AND name NOT ILIKE '%1-1/2%' AND name NOT ILIKE '%2-1/2%' AND name NOT ILIKE '%3-1/2%'
  AND name ILIKE '%EMT%' AND name ILIKE '%offset%';

-- Bender
UPDATE base_materials SET id = 'emt12_bender' 
WHERE name ILIKE '%1/2%' AND name NOT ILIKE '%1-1/2%' AND name NOT ILIKE '%2-1/2%' AND name NOT ILIKE '%3-1/2%'
  AND name ILIKE '%EMT%' AND name ILIKE '%bender%';

COMMIT;

-- ================================================================
-- STEP 3: VERIFY the migration
-- ================================================================

SELECT 
  '1/2 inch EMT Materials After Migration' as status,
  id,
  name,
  basecost,
  laborhours
FROM base_materials
WHERE id LIKE 'emt12%'
ORDER BY id;
