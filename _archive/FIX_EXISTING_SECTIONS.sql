-- ============================================
-- FIX EXISTING ESTIMATE ITEMS WITH WRONG SECTIONS
-- ============================================
-- This script will help fix items that were saved with section='general'
-- You'll need to update this based on which section each item should be in

-- First, let's see what we have:
SELECT 
  id,
  description,
  section,
  estimate_id
FROM estimate_items
WHERE section = 'general' OR section IS NULL
ORDER BY estimate_id, sequence;

-- ============================================
-- MANUAL FIX INSTRUCTIONS:
-- ============================================
-- You have two options:

-- OPTION 1 (Recommended): Delete bad data and re-enter items
-- This is the safest and cleanest approach:
/*
DELETE FROM estimate_items 
WHERE section = 'general' OR section IS NULL;

-- Then go back to your estimate and add items to the correct sections
*/

-- OPTION 2: Manually update each item's section
-- Replace the IDs and section names based on the query results above:
/*
UPDATE estimate_items 
SET section = 'lighting' 
WHERE id IN (1, 2, 3);  -- Replace with actual IDs for lighting items

UPDATE estimate_items 
SET section = 'power' 
WHERE id IN (4, 5, 6);  -- Replace with actual IDs for power items

-- Continue for other sections: branch, switchgear, feeders, equipment, special
*/

-- ============================================
-- Quick Delete for Current Estimate (if you want to start fresh):
-- ============================================
-- Uncomment and run this if you want to delete ALL items from your current estimate
-- and start over (Replace YOUR_ESTIMATE_ID with your actual estimate ID):
/*
DELETE FROM estimate_items WHERE estimate_id = 'YOUR_ESTIMATE_ID';
*/
