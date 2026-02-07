-- =====================================================
-- REORGANIZE MATERIAL IDs FOR PREFIX-BASED FILTERING
-- =====================================================
-- This script reorganizes all conduit-related materials to use
-- a consistent ID prefix pattern for easy filtering:
-- 
-- Pattern: {type}_{size}_{component}
-- Example: emt_0_5_90, emt_0_5_coupling, emt_0_5_connector
--
-- This allows the UI to filter like:
--   baseId = "emt_0_5"
--   fittings = materials.filter(m => m.id.startsWith(baseId + "_"))
-- =====================================================

-- Step 1: Check current EMT materials
SELECT id, name, category 
FROM base_materials 
WHERE name ILIKE '%EMT%'
ORDER BY name;

-- =====================================================
-- EXAMPLE REORGANIZATION FOR 1/2" EMT
-- =====================================================

-- Base conduit should already be emt_0_5
-- Now update all related fittings/accessories:

-- 1/2" EMT 90° Elbow
UPDATE base_materials 
SET id = 'emt_0_5_90'
WHERE name ILIKE '1/2" EMT%90%' OR name ILIKE '1/2" EMT%Ell%';

-- 1/2" EMT 45° Elbow  
UPDATE base_materials 
SET id = 'emt_0_5_45'
WHERE name ILIKE '1/2" EMT%45%';

-- 1/2" EMT LB Fitting
UPDATE base_materials 
SET id = 'emt_0_5_lb'
WHERE name ILIKE '1/2" EMT%LB%' OR name ILIKE '1/2" EMT% LB %';

-- 1/2" EMT LL Fitting
UPDATE base_materials 
SET id = 'emt_0_5_ll'
WHERE name ILIKE '1/2" EMT%LL%' OR name ILIKE '1/2" EMT% LL %';

-- 1/2" EMT LR Fitting
UPDATE base_materials 
SET id = 'emt_0_5_lr'
WHERE name ILIKE '1/2" EMT%LR%' OR name ILIKE '1/2" EMT% LR %';

-- 1/2" EMT Coupling
UPDATE base_materials 
SET id = 'emt_0_5_coupling'
WHERE name ILIKE '1/2" EMT%Coupling%' AND name NOT ILIKE '%Connector%';

-- 1/2" EMT Connector
UPDATE base_materials 
SET id = 'emt_0_5_connector'
WHERE name ILIKE '1/2" EMT%Connector%';

-- 1/2" EMT Strap
UPDATE base_materials 
SET id = 'emt_0_5_strap'
WHERE name ILIKE '1/2" EMT%Strap%' OR name ILIKE '1/2" EMT%Clamp%';

-- 1/2" EMT Bushing
UPDATE base_materials 
SET id = 'emt_0_5_bushing'
WHERE name ILIKE '1/2" EMT%Bushing%';

-- 1/2" EMT Pulling Elbow (if exists)
UPDATE base_materials 
SET id = 'emt_0_5_pulling_elbow'
WHERE name ILIKE '1/2" EMT%Pull%';

-- =====================================================
-- EXAMPLE FOR 3/4" EMT
-- =====================================================

-- Base conduit: emt_0_75
UPDATE base_materials SET id = 'emt_0_75' WHERE name ILIKE '3/4" EMT Conduit%';

-- 3/4" EMT 90° Elbow
UPDATE base_materials SET id = 'emt_0_75_90'
WHERE name ILIKE '3/4" EMT%90%' OR name ILIKE '3/4" EMT%Ell%';

-- 3/4" EMT 45° Elbow
UPDATE base_materials SET id = 'emt_0_75_45'
WHERE name ILIKE '3/4" EMT%45%';

-- 3/4" EMT LB Fitting
UPDATE base_materials SET id = 'emt_0_75_lb'
WHERE name ILIKE '3/4" EMT%LB%';

-- 3/4" EMT LL Fitting
UPDATE base_materials SET id = 'emt_0_75_ll'
WHERE name ILIKE '3/4" EMT%LL%';

-- 3/4" EMT LR Fitting
UPDATE base_materials SET id = 'emt_0_75_lr'
WHERE name ILIKE '3/4" EMT%LR%';

-- 3/4" EMT Coupling
UPDATE base_materials SET id = 'emt_0_75_coupling'
WHERE name ILIKE '3/4" EMT%Coupling%' AND name NOT ILIKE '%Connector%';

-- 3/4" EMT Connector
UPDATE base_materials SET id = 'emt_0_75_connector'
WHERE name ILIKE '3/4" EMT%Connector%';

-- 3/4" EMT Strap
UPDATE base_materials SET id = 'emt_0_75_strap'
WHERE name ILIKE '3/4" EMT%Strap%' OR name ILIKE '3/4" EMT%Clamp%';

-- 3/4" EMT Bushing
UPDATE base_materials SET id = 'emt_0_75_bushing'
WHERE name ILIKE '3/4" EMT%Bushing%';

-- =====================================================
-- COMPLETE SCRIPT TEMPLATE
-- =====================================================
-- TO DO: Repeat for all sizes:
-- - 1" EMT (emt_1_0)
-- - 1-1/4" EMT (emt_1_25)
-- - 1-1/2" EMT (emt_1_5)
-- - 2" EMT (emt_2_0)
-- - 2-1/2" EMT (emt_2_5)
-- - 3" EMT (emt_3_0)
-- - 3-1/2" EMT (emt_3_5)
-- - 4" EMT (emt_4_0)
--
-- Then repeat for other conduit types:
-- - Rigid (rigid_*)
-- - IMC (imc_*)
-- - PVC (pvc_*)
-- - Flex (flex_*)
-- - etc.
-- =====================================================

-- After updates, verify the new structure:
SELECT id, name, category 
FROM base_materials 
WHERE id LIKE 'emt_0_5%'
ORDER BY id;

SELECT id, name, category 
FROM base_materials 
WHERE id LIKE 'emt_0_75%'
ORDER BY id;
