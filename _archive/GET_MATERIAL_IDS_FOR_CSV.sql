-- GET MATERIAL IDS FOR CSV ASSEMBLY UPLOAD
-- Run these queries in Supabase SQL Editor to get the UUIDs needed for your CSV

-- ============================================
-- STEP 1: Get EMT Conduit IDs
-- ============================================
SELECT 
  id as material_id,
  name as material_name,
  category,
  basecost as price,
  unit
FROM base_materials
WHERE name ILIKE '%EMT%' 
  AND name ILIKE '%Conduit%'
  AND name NOT ILIKE '%fitting%'
  AND name NOT ILIKE '%connector%'
  AND name NOT ILIKE '%coupling%'
ORDER BY name;

-- Copy the IDs and use them to replace:
-- REPLACE_WITH_3_4_EMT_ID (for 3/4" EMT)
-- REPLACE_WITH_1_EMT_ID (for 1" EMT)
-- REPLACE_WITH_1_25_EMT_ID (for 1-1/4" EMT)
-- REPLACE_WITH_2_EMT_ID (for 2" EMT)

-- ============================================
-- STEP 2: Get Rigid Conduit IDs
-- ============================================
SELECT 
  id as material_id,
  name as material_name,
  category,
  basecost as price,
  unit
FROM base_materials
WHERE name ILIKE '%Rigid%' 
  AND name ILIKE '%Conduit%'
  AND name NOT ILIKE '%fitting%'
  AND name NOT ILIKE '%connector%'
  AND name NOT ILIKE '%coupling%'
ORDER BY name;

-- Copy the IDs and use them to replace:
-- REPLACE_WITH_3_4_RIGID_ID (for 3/4" Rigid)
-- REPLACE_WITH_1_RIGID_ID (for 1" Rigid)
-- REPLACE_WITH_1_5_RIGID_ID (for 1-1/2" Rigid)

-- ============================================
-- STEP 3: Get PVC Conduit IDs
-- ============================================
SELECT 
  id as material_id,
  name as material_name,
  category,
  basecost as price,
  unit
FROM base_materials
WHERE name ILIKE '%PVC%' 
  AND name ILIKE '%Conduit%'
  AND name NOT ILIKE '%fitting%'
  AND name NOT ILIKE '%connector%'
  AND name NOT ILIKE '%coupling%'
ORDER BY name;

-- Copy the IDs and use them to replace:
-- REPLACE_WITH_3_4_PVC_ID (for 3/4" PVC)
-- REPLACE_WITH_2_PVC_ID (for 2" PVC)

-- ============================================
-- STEP 4: Get #12 THHN Wire IDs
-- ============================================
SELECT 
  id as material_id,
  name as material_name,
  category,
  basecost as price,
  unit
FROM base_materials
WHERE name ILIKE '%#12%' 
  AND name ILIKE '%THHN%'
ORDER BY name;

-- Copy the IDs and use them to replace:
-- REPLACE_WITH_12_BLACK_ID (for #12 THHN Black)
-- REPLACE_WITH_12_WHITE_ID (for #12 THHN White)
-- REPLACE_WITH_12_RED_ID (for #12 THHN Red)
-- REPLACE_WITH_12_GREEN_ID (for #12 THHN Green)

-- ============================================
-- STEP 5: Get #10 THHN Wire IDs
-- ============================================
SELECT 
  id as material_id,
  name as material_name,
  category,
  basecost as price,
  unit
FROM base_materials
WHERE name ILIKE '%#10%' 
  AND name ILIKE '%THHN%'
ORDER BY name;

-- Copy the IDs and use them to replace:
-- REPLACE_WITH_10_BLACK_ID (for #10 THHN Black)
-- REPLACE_WITH_10_WHITE_ID (for #10 THHN White)
-- REPLACE_WITH_10_RED_ID (for #10 THHN Red)
-- REPLACE_WITH_10_BLUE_ID (for #10 THHN Blue)
-- REPLACE_WITH_10_GREEN_ID (for #10 THHN Green)

-- ============================================
-- STEP 6: Get #12 THWN Wire IDs (for PVC)
-- ============================================
SELECT 
  id as material_id,
  name as material_name,
  category,
  basecost as price,
  unit
FROM base_materials
WHERE name ILIKE '%#12%' 
  AND name ILIKE '%THWN%'
ORDER BY name;

-- Copy the IDs and use them to replace:
-- REPLACE_WITH_12_THWN_BLACK_ID (for #12 THWN Black)
-- REPLACE_WITH_12_THWN_WHITE_ID (for #12 THWN White)
-- REPLACE_WITH_12_THWN_GREEN_ID (for #12 THWN Green)

-- ============================================
-- STEP 7: Get #10 THWN Wire IDs (for PVC)
-- ============================================
SELECT 
  id as material_id,
  name as material_name,
  category,
  basecost as price,
  unit
FROM base_materials
WHERE name ILIKE '%#10%' 
  AND name ILIKE '%THWN%'
ORDER BY name;

-- Copy the IDs and use them to replace:
-- REPLACE_WITH_10_THWN_BLACK_ID (for #10 THWN Black)
-- REPLACE_WITH_10_THWN_WHITE_ID (for #10 THWN White)
-- REPLACE_WITH_10_THWN_RED_ID (for #10 THWN Red)
-- REPLACE_WITH_10_THWN_GREEN_ID (for #10 THWN Green)

-- ============================================
-- TROUBLESHOOTING: If materials are missing
-- ============================================

-- Check what conduit/wire materials you DO have:
SELECT 
  name,
  category,
  unit,
  id
FROM base_materials
WHERE (name ILIKE '%conduit%' OR name ILIKE '%wire%' OR name ILIKE '%thhn%' OR name ILIKE '%thwn%')
  AND category NOT ILIKE '%fitting%'
ORDER BY category, name;

-- If you're missing materials, you'll need to add them to base_materials first
-- before you can create assemblies with them.
