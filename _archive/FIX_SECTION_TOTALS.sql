-- =====================================================
-- FIX ESTIMATE SECTION TOTALS
-- This will update the section field for your estimate items
-- =====================================================

-- STEP 1: First, let's see what you have
-- Run this to see all your current estimate items:
SELECT id, description, section, quantity, material_unit_cost, labor_hours, estimate_id
FROM estimate_items
WHERE estimate_id = 'YOUR_ESTIMATE_ID_HERE'
ORDER BY sequence;

-- STEP 2: Update items to assign them to the correct sections
-- Based on your screenshot showing "Standard 20A Receptacle Assembly" in lighting,
-- here's how to assign items to sections:

-- Option A: Update specific items by their description
-- Example: Assign all receptacle items to 'lighting'
UPDATE estimate_items 
SET section = 'lighting'
WHERE estimate_id = 'YOUR_ESTIMATE_ID_HERE'
  AND description ILIKE '%receptacle%';

-- Example: Assign switch items to 'power'
UPDATE estimate_items 
SET section = 'power'
WHERE estimate_id = 'YOUR_ESTIMATE_ID_HERE'
  AND description ILIKE '%switch%';

-- Example: Assign breaker/panel items to 'branch'
UPDATE estimate_items 
SET section = 'branch'
WHERE estimate_id = 'YOUR_ESTIMATE_ID_HERE'
  AND (description ILIKE '%breaker%' OR description ILIKE '%panel%');

-- Example: Assign conduit/wire items to 'feeders'
UPDATE estimate_items 
SET section = 'feeders'
WHERE estimate_id = 'YOUR_ESTIMATE_ID_HERE'
  AND (description ILIKE '%conduit%' OR description ILIKE '%wire%');


-- Option B: Update items by their ID (more precise)
-- First, get the IDs from STEP 1 above, then:
UPDATE estimate_items 
SET section = 'lighting'
WHERE id = 'ITEM_ID_HERE';

UPDATE estimate_items 
SET section = 'power'
WHERE id = 'ANOTHER_ITEM_ID_HERE';

-- Continue for each item...


-- STEP 3: Verify the fix worked
-- Run this to see items grouped by section:
SELECT section, COUNT(*) as item_count, SUM(material_total) as total_materials
FROM estimate_items
WHERE estimate_id = 'YOUR_ESTIMATE_ID_HERE'
GROUP BY section
ORDER BY section;


-- =====================================================
-- HOW TO FIND YOUR ESTIMATE_ID:
-- =====================================================
-- Run this to see your recent estimates:
SELECT id, estimate_number, project_name, created_at
FROM estimates
ORDER BY created_at DESC
LIMIT 10;

-- Copy the 'id' value and replace 'YOUR_ESTIMATE_ID_HERE' above
-- =====================================================
