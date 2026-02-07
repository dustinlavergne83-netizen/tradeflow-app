


-- ================================================
-- FIX #1: SECTION TOTALS PROBLEM
-- All your items are in 'general' - need to assign to proper sections
-- ================================================

-- STEP 1: Tell me which estimate has the items
-- Look at your app, find the estimate ID for "Crowley High AC Replacement - CO-01 Change Order"
-- Replace 'YOUR_ESTIMATE_ID_HERE' below with the actual ID from screenshot 1

-- OPTION A: If you want to move specific items to 'lighting' section
-- Find the item IDs from screenshot 2, then run:
UPDATE estimate_items 
SET section = 'lighting'
WHERE id IN ('e1f26522-4e07-4d1f-b593-e88677fa632e', '57d94988-0cd4-4928-9a7d-836a241d00a1', '9e39294f-4169-4fea-a14c-8d8286ccee8bd');
-- Replace the IDs above with your actual item IDs that should be in lighting

-- OPTION B: If you know what the items should be based on description
UPDATE estimate_items 
SET section = 'lighting'
WHERE description LIKE '%Receptacle%' OR description LIKE '%20A%';

-- OPTION C: Manual assignment - Run this for EACH item, changing the section name
-- UPDATE estimate_items SET section = 'lighting' WHERE id = 'ITEM_ID_HERE';
-- UPDATE estimate_items SET section = 'power' WHERE id = 'ANOTHER_ITEM_ID_HERE';
-- etc...


-- ================================================
-- FIX #2: CHANGE ORDER NOT SHOWING AS CHANGE ORDER
-- ================================================

-- First, let's see which estimate should be the change order
-- From screenshot 1, they're all marked as "Regular Estimate"
-- You need to tell me which one is CO-01

-- OPTION A: Update the estimate_number to include CO- prefix
UPDATE estimates 
SET estimate_number = 'CO-01'
WHERE id = 'YOUR_ESTIMATE_ID_FOR_CHANGE_ORDER';

-- OPTION B: If there's a flag field (is_change_order, type, etc.)
-- UPDATE estimates SET is_change_order = true WHERE id = 'YOUR_ESTIMATE_ID';

-- To find the right estimate ID, look at screenshot 1:
-- The most recent one is effc9a36-a545-466d-b268-419575f0fbe1 (EST-1010)
-- If that's your CO-01, use that ID


-- ================================================
-- VERIFICATION - Run this after making changes
-- ================================================

-- Check sections are fixed:
SELECT 
    section,
    COUNT(*) as items,
    SUM(material_total) as materials
FROM estimate_items
WHERE estimate_id = 'YOUR_ESTIMATE_ID'
GROUP BY section;

-- Check change order is flagged:
SELECT 
    estimate_number,
    CASE 
        WHEN estimate_number LIKE '%CO%' THEN '✓ CHANGE ORDER'
        ELSE '✗ Regular'
    END as type
FROM estimates
WHERE id = 'YOUR_ESTIMATE_ID';


-- ================================================
-- TELL ME:
-- 1. Which estimate ID is the change order? (from screenshot 1)
-- 2. Which items should be in which sections?
-- I'll give you the exact SQL to run
-- ================================================
