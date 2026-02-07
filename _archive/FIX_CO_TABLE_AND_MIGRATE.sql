-- Step 1: Drop the old simple table
DROP TABLE IF EXISTS change_order_items CASCADE;

-- Step 2: Create the proper table with all needed columns
CREATE TABLE change_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  change_order_id UUID NOT NULL REFERENCES change_orders(id) ON DELETE CASCADE,
  section TEXT NOT NULL,
  sequence INTEGER NOT NULL DEFAULT 0,
  description TEXT NOT NULL,
  quantity DECIMAL(10,2) NOT NULL DEFAULT 0,
  unit TEXT NOT NULL DEFAULT 'ea',
  material_unit_cost DECIMAL(10,2) NOT NULL DEFAULT 0,
  material_total DECIMAL(10,2) NOT NULL DEFAULT 0,
  waste_factor DECIMAL(10,2) NOT NULL DEFAULT 0,
  labor_hours DECIMAL(10,2) NOT NULL DEFAULT 0,
  labor_multiplier DECIMAL(10,2) NOT NULL DEFAULT 1.0,
  labor_rate DECIMAL(10,2) NOT NULL DEFAULT 0,
  labor_total DECIMAL(10,2) NOT NULL DEFAULT 0,
  equipment_total DECIMAL(10,2) NOT NULL DEFAULT 0,
  subcontractor_cost DECIMAL(10,2) NOT NULL DEFAULT 0,
  line_total DECIMAL(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Step 3: Create index
CREATE INDEX idx_change_order_items_co_id ON change_order_items(change_order_id);

-- Step 4: Now migrate the data from estimate_items
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

-- Step 5: Update change_orders total
UPDATE change_orders
SET total = (
  SELECT COALESCE(SUM(material_total + labor_total), 0)
  FROM change_order_items
  WHERE change_order_id = change_orders.id
)
WHERE change_order_number = 'CO-01';

-- Step 6: Delete from estimate_items
DELETE FROM estimate_items
WHERE estimate_id IN (
  SELECT id FROM estimates WHERE estimate_number = 'CO-01'
);

-- Step 7: Delete from estimates
DELETE FROM estimates
WHERE estimate_number = 'CO-01';

-- Verification
SELECT 
  'SUCCESS!' as status,
  COUNT(*) as items_migrated,
  SUM(material_total + labor_total) as change_order_total
FROM change_order_items coi
JOIN change_orders co ON co.id = coi.change_order_id
WHERE co.change_order_number = 'CO-01';
