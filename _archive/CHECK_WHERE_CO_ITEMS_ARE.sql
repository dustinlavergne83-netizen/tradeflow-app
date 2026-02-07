-- Check where CO-01 items are stored

-- 1. Check if items are in estimate_items (old/wrong location)
SELECT 'estimate_items' as table_name, COUNT(*) as item_count
FROM estimate_items ei
JOIN estimates e ON e.id = ei.estimate_id
WHERE e.estimate_number = 'CO-01';

-- 2. Check if items are in change_order_items (new/correct location)
SELECT 'change_order_items' as table_name, COUNT(*) as item_count
FROM change_order_items coi
JOIN change_orders co ON co.id = coi.change_order_id
WHERE co.change_order_number = 'CO-01';

-- 3. See the actual items in estimate_items for CO-01
SELECT ei.*, e.estimate_number
FROM estimate_items ei
JOIN estimates e ON e.id = ei.estimate_id
WHERE e.estimate_number = 'CO-01'
ORDER BY ei.section, ei.sequence;

-- 4. See the actual items in change_order_items for CO-01
SELECT coi.*, co.change_order_number
FROM change_order_items coi
JOIN change_orders co ON co.id = coi.change_order_id
WHERE co.change_order_number = 'CO-01'
ORDER BY coi.section, coi.sequence;

/*
MIGRATION SOLUTION:
If items are in estimate_items (query 1 shows count > 0) and not in change_order_items (query 2 shows 0),
you have two options:

OPTION A - Clean Start (Recommended):
1. Delete the old CO-01 items from estimate_items
2. Delete the CO-01 estimate record
3. Just re-add the items (they'll save correctly now)

OPTION B - Migrate the data:
Run the migration script I'll create next
*/
