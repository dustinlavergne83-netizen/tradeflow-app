-- Check ALL items for change order CO-01
-- Run this in Supabase SQL Editor

SELECT 
  section,
  description,
  quantity,
  material_total,
  labor_total,
  (material_total + labor_total) as line_total
FROM change_order_items
WHERE change_order_id = '3ca17ce8-d75a-4649-9758-29556b4e7ea2'
ORDER BY section, sequence;

-- Summary by section
SELECT 
  section,
  COUNT(*) as item_count,
  SUM(material_total) as total_material,
  SUM(labor_total) as total_labor,
  SUM(material_total + labor_total) as section_total
FROM change_order_items
WHERE change_order_id = '3ca17ce8-d75a-4649-9758-29556b4e7ea2'
GROUP BY section;

-- GRAND TOTAL
SELECT 
  SUM(material_total + labor_total) as grand_total
FROM change_order_items
WHERE change_order_id = '3ca17ce8-d75a-4649-9758-29556b4e7ea2';
