-- ========================================
-- Link Fittings to BOTH Compression AND Set-Screw Types
-- ========================================
-- This updates fittings to use the correct coupling/connector based on their type
-- Compression fittings → Compression couplings/connectors
-- Set-Screw fittings → Set-Screw couplings/connectors
-- ========================================

-- STEP 1: Get the material IDs (replace these with actual IDs from your query)
-- ========================================
-- Run this first to find the IDs:
-- SELECT id, name FROM base_materials WHERE name ILIKE '%1/2" emt%coupling%' AND name NOT ILIKE '%1-1/2%';
-- SELECT id, name FROM base_materials WHERE name ILIKE '%1/2" emt%connector%' AND name NOT ILIKE '%1-1/2%';

-- STEP 2: Link COMPRESSION fittings to COMPRESSION couplings
-- ========================================
UPDATE base_materials 
SET auto_add_coupling_id = 'PASTE_COMPRESSION_COUPLING_ID_HERE'
WHERE name ILIKE '%1/2" emt%'
  AND name NOT ILIKE '%1-1/2%'
  AND name ILIKE '%compression%'
  AND (name ILIKE '%90%' OR name ILIKE '%45%');

-- STEP 3: Link SET-SCREW fittings to SET-SCREW couplings
-- ========================================
UPDATE base_materials 
SET auto_add_coupling_id = 'PASTE_SETSCREW_COUPLING_ID_HERE'
WHERE name ILIKE '%1/2" emt%'
  AND name NOT ILIKE '%1-1/2%'
  AND name ILIKE '%set%screw%'
  AND (name ILIKE '%90%' OR name ILIKE '%45%');

-- STEP 4: Link COMPRESSION bodies to COMPRESSION connectors
-- ========================================
UPDATE base_materials 
SET auto_add_connector_id = 'PASTE_COMPRESSION_CONNECTOR_ID_HERE'
WHERE name ILIKE '%1/2" emt%'
  AND name NOT ILIKE '%1-1/2%'
  AND name ILIKE '%compression%'
  AND (name ILIKE '%lb%' OR name ILIKE '%ll%' OR name ILIKE '%lr%' OR name ILIKE '%body%');

-- STEP 5: Link SET-SCREW bodies to SET-SCREW connectors
-- ========================================
UPDATE base_materials 
SET auto_add_connector_id = 'PASTE_SETSCREW_CONNECTOR_ID_HERE'
WHERE name ILIKE '%1/2" emt%'
  AND name NOT ILIKE '%1-1/2%'
  AND name ILIKE '%set%screw%'
  AND (name ILIKE '%lb%' OR name ILIKE '%ll%' OR name ILIKE '%lr%' OR name ILIKE '%body%');

-- STEP 6: Verify it worked - show which fitting links to which coupling/connector
-- ========================================
SELECT 
  f.name AS fitting,
  CASE 
    WHEN f.name ILIKE '%compression%' THEN 'Compression'
    WHEN f.name ILIKE '%set%screw%' THEN 'Set-Screw'
    ELSE 'Unknown'
  END AS fitting_type,
  COALESCE(c.name, cn.name, 'NOT LINKED') AS will_auto_add,
  CASE 
    WHEN c.name ILIKE '%compression%' OR cn.name ILIKE '%compression%' THEN 'Compression'
    WHEN c.name ILIKE '%set%screw%' OR cn.name ILIKE '%set%screw%' THEN 'Set-Screw'
    ELSE 'None'
  END AS linked_type,
  CASE 
    WHEN (f.name ILIKE '%compression%' AND (c.name ILIKE '%compression%' OR cn.name ILIKE '%compression%'))
         OR (f.name ILIKE '%set%screw%' AND (c.name ILIKE '%set%screw%' OR cn.name ILIKE '%set%screw%'))
    THEN '✓ MATCH'
    WHEN c.name IS NULL AND cn.name IS NULL THEN '✗ NOT LINKED'
    ELSE '✗ WRONG TYPE'
  END AS status
FROM base_materials f
LEFT JOIN base_materials c ON f.auto_add_coupling_id = c.id
LEFT JOIN base_materials cn ON f.auto_add_connector_id = cn.id
WHERE f.name ILIKE '%1/2" emt%'
  AND f.name NOT ILIKE '%1-1/2%'
  AND (f.name ILIKE '%90%' OR f.name ILIKE '%45%' OR f.name ILIKE '%body%')
ORDER BY f.name;

-- ========================================
-- INSTRUCTIONS:
-- ========================================
-- 1. Run STEP 1 queries to get the 4 material IDs you need
-- 2. Paste each ID into the appropriate UPDATE statement (STEP 2-5)
-- 3. Run all 4 UPDATE statements
-- 4. Run STEP 6 to verify - look for "✓ MATCH" status
-- ========================================
