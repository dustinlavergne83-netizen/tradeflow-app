-- ================================================================
-- MIGRATION: 1/2" EMT Materials to emt05_ Pattern
-- ================================================================
-- This will rename all 1/2" EMT materials to follow consistent pattern:
-- emt05 (conduit), emt05_90 (90° elbow), emt05_connector, etc.

-- ================================================================
-- STEP 1: CHECK what 1/2" EMT materials currently exist
-- ================================================================
SELECT 
  'Current 1/2" EMT Materials' as status,
  id as current_id,
  name,
  category,
  basecost,
  laborhours,
  CASE
    WHEN name ILIKE '%conduit%' AND name NOT ILIKE '%fitting%' AND name NOT ILIKE '%connector%' 
         AND name NOT ILIKE '%coupling%' AND name NOT ILIKE '%elbow%' THEN 'emt05'
    WHEN name ILIKE '%90%' OR (name ILIKE '%elbow%' AND name NOT ILIKE '%45%') THEN 'emt05_90'
    WHEN name ILIKE '%45%' THEN 'emt05_45'
    WHEN name ILIKE '%connector%' AND name ILIKE '%set%screw%' THEN 'emt05_ssconn'
    WHEN name ILIKE '%connector%' AND name ILIKE '%compression%' THEN 'emt05_cpconn'
    WHEN name ILIKE '%connector%' THEN 'emt05_ssconn'  -- default to set screw if not specified
    WHEN name ILIKE '%coupling%' AND name ILIKE '%set%screw%' THEN 'emt05_sscpl'
    WHEN name ILIKE '%coupling%' AND name ILIKE '%compression%' THEN 'emt05_cpcpl'
    WHEN name ILIKE '%coupling%' THEN 'emt05_sscpl'  -- default to set screw if not specified
    WHEN name ILIKE '%LB%' THEN 'emt05_lb'
    WHEN name ILIKE '%LL%' THEN 'emt05_ll'
    WHEN name ILIKE '%LR%' THEN 'emt05_lr'
    WHEN name ILIKE '%T%body%' OR name ILIKE '% T ' THEN 'emt05_t'
    WHEN name ILIKE '%C%body%' OR name ILIKE '% C ' THEN 'emt05_c'
    WHEN name ILIKE '%strap%' OR name ILIKE '%clamp%' THEN 'emt05_strap'
    WHEN name ILIKE '%bushing%' THEN 'emt05_bushing'
    WHEN name ILIKE '%offset%' THEN 'emt05_offset'
    WHEN name ILIKE '%pull%' THEN 'emt05_pulling'
    ELSE 'emt05_other'
  END as proposed_new_id
FROM base_materials
WHERE name ILIKE '%1/2%' AND name ILIKE '%EMT%'
ORDER BY 
  CASE
    WHEN name ILIKE '%conduit%' THEN 1
    WHEN name ILIKE '%90%' THEN 2
    WHEN name ILIKE '%45%' THEN 3
    WHEN name ILIKE '%connector%' THEN 4
    WHEN name ILIKE '%coupling%' THEN 5
    WHEN name ILIKE '%strap%' THEN 6
    ELSE 99
  END,
  name;

-- ================================================================
-- STEP 2: CHECK if any assemblies use these materials
-- ================================================================
SELECT 
  'Assemblies Using 1/2" EMT' as info,
  a.id as assembly_id,
  a.name as assembly_name,
  ac.material_id as current_material_id,
  bm.name as material_name,
  ac.component_quantity
FROM assembly_components ac
JOIN base_materials bm ON ac.material_id = bm.id
JOIN assemblies a ON ac.assembly_id = a.id
WHERE bm.name ILIKE '%1/2%' AND bm.name ILIKE '%EMT%'
ORDER BY a.name, bm.name;

-- ================================================================
-- STEP 3: CHECK for ID conflicts (make sure new IDs don't exist)
-- ================================================================
SELECT 
  'Checking for ID conflicts' as check_type,
  id,
  name
FROM base_materials
WHERE id IN (
  'emt05',
  'emt05_90',
  'emt05_45',
  'emt05_ssconn',
  'emt05_cpconn',
  'emt05_sscpl',
  'emt05_cpcpl',
  'emt05_lb',
  'emt05_ll',
  'emt05_lr',
  'emt05_t',
  'emt05_c',
  'emt05_strap',
  'emt05_bushing',
  'emt05_offset'
);

-- ================================================================
-- STEP 4: MIGRATION SCRIPT (run after reviewing above queries)
-- ================================================================
-- IMPORTANT: Review the results of queries above before running these updates!
-- Uncomment the updates below when ready to execute.

/*
-- Start transaction
BEGIN;

-- 1/2" EMT Conduit (base)
UPDATE base_materials 
SET id = 'emt05'
WHERE name ILIKE '%1/2%' AND name ILIKE '%EMT%'
  AND name ILIKE '%conduit%' 
  AND name NOT ILIKE '%fitting%'
  AND name NOT ILIKE '%connector%'
  AND name NOT ILIKE '%coupling%'
  AND name NOT ILIKE '%elbow%'
  AND id != 'emt05';

-- 1/2" EMT 90° Elbow
UPDATE base_materials 
SET id = 'emt05_90'
WHERE name ILIKE '%1/2%' AND name ILIKE '%EMT%'
  AND (name ILIKE '%90%' OR (name ILIKE '%elbow%' AND name NOT ILIKE '%45%'))
  AND id != 'emt05_90';

-- 1/2" EMT 45° Elbow
UPDATE base_materials 
SET id = 'emt05_45'
WHERE name ILIKE '%1/2%' AND name ILIKE '%EMT%'
  AND name ILIKE '%45%'
  AND id != 'emt05_45';

-- 1/2" EMT Set Screw Connector
UPDATE base_materials 
SET id = 'emt05_ssconn'
WHERE name ILIKE '%1/2%' AND name ILIKE '%EMT%'
  AND name ILIKE '%connector%'
  AND (name ILIKE '%set%screw%' OR name NOT ILIKE '%compression%')
  AND id != 'emt05_ssconn';

-- 1/2" EMT Compression Connector
UPDATE base_materials 
SET id = 'emt05_cpconn'
WHERE name ILIKE '%1/2%' AND name ILIKE '%EMT%'
  AND name ILIKE '%connector%'
  AND name ILIKE '%compression%'
  AND id != 'emt05_cpconn';

-- 1/2" EMT Set Screw Coupling
UPDATE base_materials 
SET id = 'emt05_sscpl'
WHERE name ILIKE '%1/2%' AND name ILIKE '%EMT%'
  AND name ILIKE '%coupling%'
  AND (name ILIKE '%set%screw%' OR name NOT ILIKE '%compression%')
  AND name NOT ILIKE '%connector%'
  AND id != 'emt05_sscpl';

-- 1/2" EMT Compression Coupling
UPDATE base_materials 
SET id = 'emt05_cpcpl'
WHERE name ILIKE '%1/2%' AND name ILIKE '%EMT%'
  AND name ILIKE '%coupling%'
  AND name ILIKE '%compression%'
  AND name NOT ILIKE '%connector%'
  AND id != 'emt05_cpcpl';

-- 1/2" EMT LB Fitting
UPDATE base_materials 
SET id = 'emt05_lb'
WHERE name ILIKE '%1/2%' AND name ILIKE '%EMT%'
  AND name ILIKE '%LB%'
  AND id != 'emt05_lb';

-- 1/2" EMT LL Fitting
UPDATE base_materials 
SET id = 'emt05_ll'
WHERE name ILIKE '%1/2%' AND name ILIKE '%EMT%'
  AND name ILIKE '%LL%'
  AND id != 'emt05_ll';

-- 1/2" EMT LR Fitting
UPDATE base_materials 
SET id = 'emt05_lr'
WHERE name ILIKE '%1/2%' AND name ILIKE '%EMT%'
  AND name ILIKE '%LR%'
  AND id != 'emt05_lr';

-- 1/2" EMT T Body
UPDATE base_materials 
SET id = 'emt05_t'
WHERE name ILIKE '%1/2%' AND name ILIKE '%EMT%'
  AND (name ILIKE '%T%body%' OR name ILIKE '% T ')
  AND id != 'emt05_t';

-- 1/2" EMT C Body
UPDATE base_materials 
SET id = 'emt05_c'
WHERE name ILIKE '%1/2%' AND name ILIKE '%EMT%'
  AND (name ILIKE '%C%body%' OR name ILIKE '% C ')
  AND id != 'emt05_c';

-- 1/2" EMT Strap
UPDATE base_materials 
SET id = 'emt05_strap'
WHERE name ILIKE '%1/2%' AND name ILIKE '%EMT%'
  AND (name ILIKE '%strap%' OR name ILIKE '%clamp%')
  AND id != 'emt05_strap';

-- 1/2" EMT Bushing
UPDATE base_materials 
SET id = 'emt05_bushing'
WHERE name ILIKE '%1/2%' AND name ILIKE '%EMT%'
  AND name ILIKE '%bushing%'
  AND id != 'emt05_bushing';

-- 1/2" EMT Offset Connector
UPDATE base_materials 
SET id = 'emt05_offset'
WHERE name ILIKE '%1/2%' AND name ILIKE '%EMT%'
  AND name ILIKE '%offset%'
  AND id != 'emt05_offset';

-- 1/2" EMT Pulling Elbow (if exists)
UPDATE base_materials 
SET id = 'emt05_pulling'
WHERE name ILIKE '%1/2%' AND name ILIKE '%EMT%'
  AND name ILIKE '%pull%'
  AND id != 'emt05_pulling';

-- Commit if everything looks good
COMMIT;

-- Or rollback if there are issues
-- ROLLBACK;
*/

-- ================================================================
-- STEP 5: VERIFY after migration
-- ================================================================
/*
-- Run this after migration to verify
SELECT 
  'After Migration - All emt05 materials' as status,
  id,
  name,
  category,
  basecost,
  laborhours
FROM base_materials
WHERE id LIKE 'emt05%'
ORDER BY id;

-- Check assemblies still work
SELECT 
  'Assemblies after migration' as info,
  a.name as assembly_name,
  ac.material_id,
  bm.name as material_name
FROM assembly_components ac
JOIN base_materials bm ON ac.material_id = bm.id
JOIN assemblies a ON ac.assembly_id = a.id
WHERE ac.material_id LIKE 'emt05%'
ORDER BY a.name, ac.material_id;
*/
