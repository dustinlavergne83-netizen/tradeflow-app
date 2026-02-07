-- ⚠️ WARNING: This will DELETE ALL items from CO-01
-- Only run this if you want to start fresh
-- After running this, go back to each section and re-add the 3 items

DELETE FROM change_order_items
WHERE change_order_id = '3ca17ce8-d75a-4649-9758-29556b4e7ea2';

-- Update the change order total to 0
UPDATE change_orders
SET total = 0
WHERE id = '3ca17ce8-d75a-4649-9758-29556b4e7ea2';

-- Check it's empty
SELECT COUNT(*) as remaining_items
FROM change_order_items
WHERE change_order_id = '3ca17ce8-d75a-4649-9758-29556b4e7ea2';
