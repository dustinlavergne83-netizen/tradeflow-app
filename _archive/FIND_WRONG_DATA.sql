-- Find ALL items in switchgear and equipment sections (shouldn't be there)

-- For CHANGE ORDERS
SELECT 
    co.co_number,
    co.id as change_order_id,
    coi.section,
    coi.description,
    coi.created_at
FROM change_order_items coi
JOIN change_orders co ON co.id = coi.change_order_id
WHERE coi.section IN ('switchgear', 'equipment')
ORDER BY coi.created_at DESC
LIMIT 100;

-- For REGULAR ESTIMATES  
SELECT 
    e.estimate_number,
    e.id as estimate_id,
    ei.section,
    ei.description,
    ei.created_at
FROM estimate_items ei
JOIN estimates e ON e.id = ei.estimate_id
WHERE ei.section IN ('switchgear', 'equipment')
ORDER BY ei.created_at DESC
LIMIT 100;

-- DELETE all items from switchgear and equipment for CHANGE ORDERS
-- DELETE FROM change_order_items WHERE section IN ('switchgear', 'equipment');

-- DELETE all items from switchgear and equipment for REGULAR ESTIMATES
-- DELETE FROM estimate_items WHERE section IN ('switchgear', 'equipment');
