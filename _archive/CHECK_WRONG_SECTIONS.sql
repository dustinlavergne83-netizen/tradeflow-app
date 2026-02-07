-- Check what sections have data and what shouldn't be there

-- For regular estimates (replace YOUR_ESTIMATE_ID with the actual ID)
SELECT 
    section,
    COUNT(*) as item_count,
    STRING_AGG(description, ', ') as items
FROM estimate_items
WHERE estimate_id = YOUR_ESTIMATE_ID
GROUP BY section
ORDER BY section;

-- For change orders (replace YOUR_CO_ID with the actual ID)
SELECT 
    section,
    COUNT(*) as item_count,
    STRING_AGG(description, ', ') as items
FROM change_order_items
WHERE change_order_id = YOUR_CO_ID
GROUP BY section
ORDER BY section;

-- To DELETE items from wrong sections:
-- Delete from switchgear if it should be empty
-- DELETE FROM estimate_items WHERE estimate_id = YOUR_ESTIMATE_ID AND section = 'switchgear';

-- Delete from equipment if it should be empty  
-- DELETE FROM estimate_items WHERE estimate_id = YOUR_ESTIMATE_ID AND section = 'equipment';

-- For change orders:
-- DELETE FROM change_order_items WHERE change_order_id = YOUR_CO_ID AND section = 'switchgear';
-- DELETE FROM change_order_items WHERE change_order_id = YOUR_CO_ID AND section = 'equipment';
