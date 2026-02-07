-- Clear ALL items from your current estimate to remove duplicates
-- Run this in Supabase SQL Editor

-- First, find your estimate ID
SELECT id, estimate_number, project_name, created_at
FROM estimates
ORDER BY created_at DESC
LIMIT 5;

-- Then delete ALL items for that estimate (replace YOUR_ESTIMATE_ID)
DELETE FROM estimate_items 
WHERE estimate_id = 5510245f-33d5-48fb-b1c1-29cb873caa5c;

-- Verify items are deleted
SELECT section, COUNT(*) as item_count
FROM estimate_items
WHERE estimate_id = YOUR_ESTIMATE_ID_HERE
GROUP BY section;

-- After running this:
-- 1. Go back to your app
-- 2. Re-add items to each section
-- 3. They will now save ONLY to the correct section (the fix is working)
