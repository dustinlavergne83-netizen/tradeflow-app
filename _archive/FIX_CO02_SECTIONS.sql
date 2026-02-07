-- =====================================================
-- FIX CO-02 SECTIONS - Run this in Supabase SQL Editor
-- =====================================================

-- First, let's see which section each item SHOULD be in
-- Based on the URL, you were on the "lighting" section when you added them

-- OPTION 1: If ALL your CO-02 items should be in LIGHTING:
UPDATE estimate_items 
SET section = 'lighting'
WHERE estimate_id = (
    SELECT id FROM estimates WHERE estimate_number = 'CO-02' LIMIT 1
);

-- OPTION 2: If items are in different sections, you need to update each one individually
-- First, run this to see all your CO-02 items:
/*
SELECT 
    id,
    description,
    material_total,
    section
FROM estimate_items
WHERE estimate_id = (
    SELECT id FROM estimates WHERE estimate_number = 'CO-02' LIMIT 1
)
ORDER BY sequence;
*/

-- Then update specific items:
-- UPDATE estimate_items SET section = 'power' WHERE id = 'ITEM_ID_HERE';
-- UPDATE estimate_items SET section = 'branch' WHERE id = 'ITEM_ID_HERE';
-- etc.


-- OPTION 3: Quick guess based on item descriptions
-- Update receptacles to power
UPDATE estimate_items 
SET section = 'power'
WHERE estimate_id = (SELECT id FROM estimates WHERE estimate_number = 'CO-02' LIMIT 1)
  AND (description LIKE '%Receptacle%' OR description LIKE '%outlet%' OR description LIKE '%20A%');

-- Update lighting fixtures to lighting
UPDATE estimate_items 
SET section = 'lighting'
WHERE estimate_id = (SELECT id FROM estimates WHERE estimate_number = 'CO-02' LIMIT 1)
  AND (description LIKE '%light%' OR description LIKE '%fixture%' OR description LIKE '%lamp%');

-- Update panels/breakers to switchgear
UPDATE estimate_items 
SET section = 'switchgear'
WHERE estimate_id = (SELECT id FROM estimates WHERE estimate_number = 'CO-02' LIMIT 1)
  AND (description LIKE '%panel%' OR description LIKE '%breaker%' OR description LIKE '%disconnect%');


-- =====================================================
-- AFTER RUNNING THE UPDATE:
-- Refresh your browser on the Summary page
-- The sections should now show the correct amounts!
-- =====================================================
