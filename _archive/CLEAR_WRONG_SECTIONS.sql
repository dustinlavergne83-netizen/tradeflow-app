-- Clean up items that were saved to wrong sections
-- Run this in Supabase SQL Editor to clear old buggy data

-- First, let's see what we have
SELECT 
    section,
    COUNT(*) as item_count,
    description
FROM change_order_items
WHERE change_order_id = (SELECT id FROM change_orders ORDER BY created_at DESC LIMIT 1)
GROUP BY section, description
ORDER BY section, description;

-- If you see items in wrong sections, delete ALL items and start fresh:
-- DELETE FROM change_order_items 
-- WHERE change_order_id = YOUR_CHANGE_ORDER_ID_HERE;

-- After deleting, go back to the app and re-add your items
-- They will now save to the correct sections
