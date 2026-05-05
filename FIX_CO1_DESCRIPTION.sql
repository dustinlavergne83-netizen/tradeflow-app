-- Fix Change Order #1 description for Martin Residence project
-- Run this in Supabase SQL Editor

UPDATE change_orders
SET 
  description = 'Add Circuit for Jacuzzi, and upgrade service to 320Amp',
  title = 'Add Circuit for Jacuzzi, and upgrade service to 320Amp'
WHERE change_order_number LIKE '1007-CO1%'
  AND project_name = 'Martin Residence';

-- Verify the update:
SELECT id, change_order_number, project_name, title, description, total
FROM change_orders
WHERE change_order_number LIKE '1007-CO1%';
