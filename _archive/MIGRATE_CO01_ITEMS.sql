-- Migrate CO-01 items from estimate_items to change_order_items

-- Step 1: Copy items from estimate_items to change_order_items
INSERT INTO change_order_items (
  change_order_id,
  section,
  sequence,
  description,
  quantity,
  unit,
  material_unit_cost,
  material_total,
  waste_factor,
  labor_hours,
  labor_multiplier,
  labor_rate,
  labor_total,
  equipment_total,
  subcontractor_cost,
  line_total
)
SELECT 
  co.id as change_order_id,
  ei.section,
  ei.sequence,
  ei.description,
  ei.quantity,
  ei.unit,
  ei.material_unit_cost,
  ei.material_total,
  ei.waste_factor,
  ei.labor_hours,
  ei.labor_multiplier,
  ei.labor_rate,
  ei.labor_total,
  ei.equipment_total,
  ei.subcontractor_cost,
  ei.line_total
FROM estimate_items ei
JOIN estimates e ON e.id = ei.estimate_id
JOIN change_orders co ON co.change_order_number = e.estimate_number
WHERE e.estimate_number = 'CO-01';

-- Step 2: Update change_orders total
UPDATE change_orders
SET total = (
  SELECT COALESCE(SUM(material_total + labor_total), 0)
  FROM change_order_items
  WHERE change_order_id = change_orders.id
)
WHERE change_order_number = 'CO-01';

-- Step 3: Delete items from estimate_items (cleanup)
DELETE FROM estimate_items
WHERE estimate_id IN (
  SELECT id FROM estimates WHERE estimate_number = 'CO-01'
);

-- Step 4: Delete the estimates record (cleanup)
DELETE FROM estimates
WHERE estimate_number = 'CO-01';

-- Verification: Check the migrated data
SELECT 
  'Migrated!' as status,
  COUNT(*) as items_in_change_order_items,
  SUM(material_total + labor_total) as total
FROM change_order_items coi
JOIN change_orders co ON co.id = coi.change_order_id
WHERE co.change_order_number = 'CO-01';
