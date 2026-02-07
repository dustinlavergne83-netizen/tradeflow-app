-- ================================================================
-- COMPREHENSIVE MATERIAL ID ANALYSIS FOR REORGANIZATION
-- ================================================================
-- This script analyzes ALL materials to identify patterns and inconsistencies
-- Purpose: Create a consistent naming scheme for easier assembly creation

-- ================================================================
-- 1. CURRENT ID PATTERNS - Show what patterns exist
-- ================================================================
SELECT 
  'Current ID Prefix Patterns' as analysis_type,
  SUBSTRING(id FROM 1 FOR POSITION('_' IN id || '_') - 1) as prefix,
  COUNT(*) as count,
  array_agg(DISTINCT category) as categories,
  MIN(id) as example_id,
  MIN(name) as example_name
FROM base_materials
WHERE id LIKE '%\_%'
GROUP BY prefix
ORDER BY count DESC, prefix;

-- ================================================================
-- 2. EMT MATERIALS - Complete inventory with current IDs
-- ================================================================
SELECT 
  'EMT Materials' as type,
  id,
  name,
  category,
  unit,
  CASE 
    WHEN name ILIKE '%1/2%' THEN '0.5'
    WHEN name ILIKE '%3/4%' THEN '0.75'
    WHEN name ILIKE '%1-1/4%' OR name ILIKE '%1 1/4%' THEN '1.25'
    WHEN name ILIKE '%1-1/2%' OR name ILIKE '%1 1/2%' THEN '1.5'
    WHEN name ILIKE '%2-1/2%' OR name ILIKE '%2 1/2%' THEN '2.5'
    WHEN name ILIKE '%3-1/2%' OR name ILIKE '%3 1/2%' THEN '3.5'
    WHEN name ~ '1" ' OR name ~ '^1" ' OR name ~ ' 1"' THEN '1.0'
    WHEN name ~ '2" ' OR name ~ '^2" ' OR name ~ ' 2"' THEN '2.0'
    WHEN name ~ '3" ' OR name ~ '^3" ' OR name ~ ' 3"' THEN '3.0'
    WHEN name ~ '4" ' OR name ~ '^4" ' OR name ~ ' 4"' THEN '4.0'
    ELSE 'unknown'
  END as size_extracted,
  CASE
    WHEN name ILIKE '%conduit%' AND name NOT ILIKE '%fitting%' THEN 'conduit'
    WHEN name ILIKE '%connector%' THEN 'connector'
    WHEN name ILIKE '%coupling%' THEN 'coupling'
    WHEN name ILIKE '%90%' OR name ILIKE '%elbow%' THEN 'elbow_90'
    WHEN name ILIKE '%45%' THEN 'elbow_45'
    WHEN name ILIKE '%LB%' THEN 'lb'
    WHEN name ILIKE '%LL%' THEN 'll'
    WHEN name ILIKE '%LR%' THEN 'lr'
    WHEN name ILIKE '%T%body%' OR name ILIKE '%T %' THEN 't'
    WHEN name ILIKE '%C%body%' OR name ILIKE '%C %' THEN 'c'
    WHEN name ILIKE '%strap%' OR name ILIKE '%clamp%' THEN 'strap'
    WHEN name ILIKE '%bushing%' THEN 'bushing'
    WHEN name ILIKE '%pull%elbow%' THEN 'pulling_elbow'
    WHEN name ILIKE '%offset%' THEN 'offset'
    WHEN name ILIKE '%set%screw%' THEN 'setscrew'
    WHEN name ILIKE '%compression%' THEN 'compression'
    ELSE 'other'
  END as component_type
FROM base_materials
WHERE name ILIKE '%EMT%'
ORDER BY size_extracted, component_type, name;

-- ================================================================
-- 3. RIGID MATERIALS - Complete inventory
-- ================================================================
SELECT 
  'Rigid Materials' as type,
  id,
  name,
  category,
  unit,
  CASE 
    WHEN name ILIKE '%1/2%' THEN '0.5'
    WHEN name ILIKE '%3/4%' THEN '0.75'
    WHEN name ILIKE '%1-1/4%' OR name ILIKE '%1 1/4%' THEN '1.25'
    WHEN name ILIKE '%1-1/2%' OR name ILIKE '%1 1/2%' THEN '1.5'
    WHEN name ILIKE '%2-1/2%' OR name ILIKE '%2 1/2%' THEN '2.5'
    WHEN name ILIKE '%3-1/2%' OR name ILIKE '%3 1/2%' THEN '3.5'
    WHEN name ~ '1" ' OR name ~ '^1" ' OR name ~ ' 1"' THEN '1.0'
    WHEN name ~ '2" ' OR name ~ '^2" ' OR name ~ ' 2"' THEN '2.0'
    WHEN name ~ '3" ' OR name ~ '^3" ' OR name ~ ' 3"' THEN '3.0'
    WHEN name ~ '4" ' OR name ~ '^4" ' OR name ~ ' 4"' THEN '4.0'
    ELSE 'unknown'
  END as size_extracted,
  CASE
    WHEN name ILIKE '%conduit%' AND name NOT ILIKE '%fitting%' AND name NOT ILIKE '%body%' THEN 'conduit'
    WHEN name ILIKE '%coupling%' THEN 'coupling'
    WHEN name ILIKE '%90%' OR name ILIKE '%elbow%' THEN 'elbow_90'
    WHEN name ILIKE '%45%' THEN 'elbow_45'
    WHEN name ILIKE '%LB%' THEN 'lb'
    WHEN name ILIKE '%LL%' THEN 'll'
    WHEN name ILIKE '%LR%' THEN 'lr'
    WHEN name ILIKE '%strap%' OR name ILIKE '%clamp%' THEN 'strap'
    WHEN name ILIKE '%bushing%' THEN 'bushing'
    WHEN name ILIKE '%locknut%' THEN 'locknut'
    WHEN name ILIKE '%chase%nipple%' THEN 'nipple'
    WHEN name ILIKE '%reducing%' THEN 'reducer'
    WHEN name ILIKE '%union%' THEN 'union'
    ELSE 'other'
  END as component_type
FROM base_materials
WHERE name ILIKE '%Rigid%' AND name NOT ILIKE '%Semi%'
ORDER BY size_extracted, component_type, name;

-- ================================================================
-- 4. PVC MATERIALS - Complete inventory
-- ================================================================
SELECT 
  'PVC Materials' as type,
  id,
  name,
  category,
  unit,
  CASE 
    WHEN name ILIKE '%1/2%' THEN '0.5'
    WHEN name ILIKE '%3/4%' THEN '0.75'
    WHEN name ILIKE '%1-1/4%' OR name ILIKE '%1 1/4%' THEN '1.25'
    WHEN name ILIKE '%1-1/2%' OR name ILIKE '%1 1/2%' THEN '1.5'
    WHEN name ILIKE '%2-1/2%' OR name ILIKE '%2 1/2%' THEN '2.5'
    WHEN name ILIKE '%3-1/2%' OR name ILIKE '%3 1/2%' THEN '3.5'
    WHEN name ~ '1" ' OR name ~ '^1" ' OR name ~ ' 1"' THEN '1.0'
    WHEN name ~ '2" ' OR name ~ '^2" ' OR name ~ ' 2"' THEN '2.0'
    WHEN name ~ '3" ' OR name ~ '^3" ' OR name ~ ' 3"' THEN '3.0'
    WHEN name ~ '4" ' OR name ~ '^4" ' OR name ~ ' 4"' THEN '4.0'
    WHEN name ~ '5" ' OR name ~ '^5" ' OR name ~ ' 5"' THEN '5.0'
    WHEN name ~ '6" ' OR name ~ '^6" ' OR name ~ ' 6"' THEN '6.0'
    ELSE 'unknown'
  END as size_extracted,
  CASE
    WHEN name ILIKE '%conduit%' AND name NOT ILIKE '%fitting%' THEN 'conduit'
    WHEN name ILIKE '%male%adapter%' THEN 'adapter_male'
    WHEN name ILIKE '%female%adapter%' THEN 'adapter_female'
    WHEN name ILIKE '%coupling%' THEN 'coupling'
    WHEN name ILIKE '%90%' OR name ILIKE '%elbow%' THEN 'elbow_90'
    WHEN name ILIKE '%45%' THEN 'elbow_45'
    WHEN name ILIKE '%LB%' THEN 'lb'
    WHEN name ILIKE '%LL%' THEN 'll'
    WHEN name ILIKE '%LR%' THEN 'lr'
    WHEN name ILIKE '%sweep%' THEN 'sweep'
    WHEN name ILIKE '%strap%' OR name ILIKE '%clamp%' THEN 'strap'
    WHEN name ILIKE '%cement%' THEN 'cement'
    WHEN name ILIKE '%primer%' THEN 'primer'
    WHEN name ILIKE '%cap%' THEN 'cap'
    WHEN name ILIKE '%plug%' THEN 'plug'
    ELSE 'other'
  END as component_type
FROM base_materials
WHERE name ILIKE '%PVC%'
ORDER BY size_extracted, component_type, name;

-- ================================================================
-- 5. WIRE MATERIALS - Check current patterns
-- ================================================================
SELECT 
  'Wire Materials' as type,
  id,
  name,
  category,
  CASE 
    WHEN name ~ '#14|14 AWG' THEN '14'
    WHEN name ~ '#12|12 AWG' THEN '12'
    WHEN name ~ '#10|10 AWG' THEN '10'
    WHEN name ~ '#8|8 AWG' THEN '8'
    WHEN name ~ '#6|6 AWG' THEN '6'
    WHEN name ~ '#4|4 AWG' THEN '4'
    WHEN name ~ '#2|2 AWG' THEN '2'
    WHEN name ~ '#1[^0]|1 AWG' THEN '1'
    WHEN name ~ '1/0|1\\/0' THEN '1_0'
    WHEN name ~ '2/0|2\\/0' THEN '2_0'
    WHEN name ~ '3/0|3\\/0' THEN '3_0'
    WHEN name ~ '4/0|4\\/0' THEN '4_0'
    WHEN name ~ '250' THEN '250'
    WHEN name ~ '300' THEN '300'
    WHEN name ~ '350' THEN '350'
    WHEN name ~ '400' THEN '400'
    WHEN name ~ '500' THEN '500'
    ELSE 'unknown'
  END as wire_size,
  CASE
    WHEN name ILIKE '%black%' OR name ILIKE '%bk%' THEN 'black'
    WHEN name ILIKE '%white%' OR name ILIKE '%wh%' THEN 'white'
    WHEN name ILIKE '%red%' OR name ILIKE '%rd%' THEN 'red'
    WHEN name ILIKE '%green%' OR name ILIKE '%grn%' OR name ILIKE '%gn%' THEN 'green'
    WHEN name ILIKE '%blue%' THEN 'blue'
    WHEN name ILIKE '%yellow%' THEN 'yellow'
    WHEN name ILIKE '%gray%' OR name ILIKE '%grey%' THEN 'gray'
    WHEN name ILIKE '%bare%' THEN 'bare'
    ELSE 'other'
  END as wire_color
FROM base_materials
WHERE (name ILIKE '%THHN%' OR name ILIKE '%THWN%' OR name ILIKE '%AWG%' OR name ILIKE '%wire%')
  AND name NOT ILIKE '%romex%'
  AND name NOT ILIKE '%MC%'
ORDER BY wire_size, wire_color;

-- ================================================================
-- 6. ASSEMBLY COMPONENT USAGE - What materials are used most
-- ================================================================
SELECT 
  'Assembly Component Usage' as analysis,
  bm.id as material_id,
  bm.name as material_name,
  bm.category,
  COUNT(DISTINCT ac.assembly_id) as used_in_assemblies,
  SUM(ac.component_quantity) as total_quantity_used,
  CASE 
    WHEN bm.id ~ '^[a-z]+_[0-9_]+$' THEN 'follows_pattern'
    WHEN bm.id ~ '^[a-z]+_[a-z]+_[a-z]+$' THEN 'follows_pattern'
    WHEN bm.id ~ '_' THEN 'inconsistent'
    ELSE 'no_underscores'
  END as id_pattern_status
FROM assembly_components ac
JOIN base_materials bm ON ac.material_id = bm.id
GROUP BY bm.id, bm.name, bm.category
ORDER BY used_in_assemblies DESC, total_quantity_used DESC
LIMIT 100;

-- ================================================================
-- 7. IDENTIFY PROBLEMATIC IDS - Materials that don't follow pattern
-- ================================================================
SELECT 
  'Problematic Material IDs' as issue,
  id,
  name,
  category,
  CASE
    WHEN id NOT LIKE '%\_%' THEN 'NO_UNDERSCORE - not filterable'
    WHEN id ~ '[A-Z]' THEN 'HAS_UPPERCASE - inconsistent casing'
    WHEN id ~ ' ' THEN 'HAS_SPACES - invalid format'
    WHEN id ~ '[^a-z0-9_]' THEN 'SPECIAL_CHARS - invalid characters'
    WHEN LENGTH(id) > 50 THEN 'TOO_LONG - should be concise'
    ELSE 'OTHER_ISSUE'
  END as issue_type
FROM base_materials
WHERE 
  id NOT LIKE '%\_%' OR  -- No underscore makes filtering hard
  id ~ '[A-Z]' OR        -- Uppercase inconsistent
  id ~ ' ' OR            -- Spaces problematic
  id ~ '[^a-z0-9_]' OR   -- Special chars
  LENGTH(id) > 50
ORDER BY issue_type, name;

-- ================================================================
-- 8. CONDUIT SIZES - All sizes across all types
-- ================================================================
SELECT 
  'Conduit Sizes Summary' as summary,
  CASE 
    WHEN name ILIKE '%EMT%' THEN 'EMT'
    WHEN name ILIKE '%Rigid%' AND name NOT ILIKE '%Semi%' THEN 'RIGID'
    WHEN name ILIKE '%PVC%' THEN 'PVC'
    WHEN name ILIKE '%IMC%' THEN 'IMC'
    WHEN name ILIKE '%Flex%' THEN 'FLEX'
    ELSE 'OTHER'
  END as conduit_type,
  CASE 
    WHEN name ILIKE '%1/2%' THEN '1/2"'
    WHEN name ILIKE '%3/4%' THEN '3/4"'
    WHEN name ILIKE '%1-1/4%' OR name ILIKE '%1 1/4%' THEN '1-1/4"'
    WHEN name ILIKE '%1-1/2%' OR name ILIKE '%1 1/2%' THEN '1-1/2"'
    WHEN name ILIKE '%2-1/2%' OR name ILIKE '%2 1/2%' THEN '2-1/2"'
    WHEN name ILIKE '%3-1/2%' OR name ILIKE '%3 1/2%' THEN '3-1/2"'
    WHEN name ~ '1"' THEN '1"'
    WHEN name ~ '2"' THEN '2"'
    WHEN name ~ '3"' THEN '3"'
    WHEN name ~ '4"' THEN '4"'
    WHEN name ~ '5"' THEN '5"'
    WHEN name ~ '6"' THEN '6"'
    ELSE 'unknown'
  END as size,
  COUNT(*) as material_count
FROM base_materials
WHERE (name ILIKE '%EMT%' OR name ILIKE '%Rigid%' OR name ILIKE '%PVC%' OR name ILIKE '%IMC%' OR name ILIKE '%Flex%')
  AND (name ILIKE '%conduit%' OR name ILIKE '%fitting%' OR name ILIKE '%coupling%' 
       OR name ILIKE '%connector%' OR name ILIKE '%elbow%' OR name ILIKE '%strap%')
GROUP BY conduit_type, size
ORDER BY conduit_type, 
  CASE size
    WHEN '1/2"' THEN 1
    WHEN '3/4"' THEN 2
    WHEN '1"' THEN 3
    WHEN '1-1/4"' THEN 4
    WHEN '1-1/2"' THEN 5
    WHEN '2"' THEN 6
    WHEN '2-1/2"' THEN 7
    WHEN '3"' THEN 8
    WHEN '3-1/2"' THEN 9
    WHEN '4"' THEN 10
    WHEN '5"' THEN 11
    WHEN '6"' THEN 12
    ELSE 99
  END;

-- ================================================================
-- 9. CATEGORY ANALYSIS - What categories exist
-- ================================================================
SELECT 
  'Material Categories' as info,
  category,
  COUNT(*) as material_count,
  COUNT(DISTINCT 
    CASE WHEN id ~ '_' THEN SPLIT_PART(id, '_', 1) ELSE NULL END
  ) as unique_prefixes,
  array_agg(DISTINCT 
    CASE WHEN id ~ '_' THEN SPLIT_PART(id, '_', 1) ELSE NULL END
  ) FILTER (WHERE id ~ '_') as prefix_examples
FROM base_materials
GROUP BY category
ORDER BY material_count DESC;
