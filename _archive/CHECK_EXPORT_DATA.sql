-- Check if estimate exists for the project
SELECT id, project_name, estimate_number, created_at 
FROM estimates 
WHERE project_name LIKE '%Martin%'
ORDER BY created_at DESC
LIMIT 5;

-- Check what items were inserted (if any)
SELECT e.estimate_number, ei.section, ei.description, ei.quantity, ei.created_at
FROM estimate_items ei
JOIN estimates e ON e.id = ei.estimate_id
WHERE e.project_name LIKE '%Martin%'
ORDER BY ei.created_at DESC
LIMIT 20;

-- Check for items in 'power' section specifically
SELECT e.estimate_number, ei.section, ei.description, ei.quantity
FROM estimate_items ei
JOIN estimates e ON e.id = ei.estimate_id
WHERE ei.section = 'power'
ORDER BY ei.created_at DESC
LIMIT 10;
