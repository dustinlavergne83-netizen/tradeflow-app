-- Manually set the change order total to match what the UI shows
-- Change this number to whatever the summary page shows in the orange box

UPDATE change_orders
SET total = 24912.00
WHERE id = '3ca17ce8-d75a-4649-9758-29556b4e7ea2';

-- Verify it updated
SELECT id, co_number, total
FROM change_orders
WHERE id = '3ca17ce8-d75a-4649-9758-29556b4e7ea2';
