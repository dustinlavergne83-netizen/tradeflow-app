-- Check if predefined layers exist for this plan
SELECT * FROM measurement_layers 
WHERE plan_id = 'YOUR_PLAN_ID_HERE' 
AND is_predefined = true;

-- If they don't exist, manually insert them
-- Replace 'YOUR_PLAN_ID_HERE' and 'YOUR_COMPANY_ID_HERE' with actual values

INSERT INTO measurement_layers (plan_id, name, section_name, color, visible, is_predefined, display_order, company_id)
VALUES 
  ('YOUR_PLAN_ID_HERE', 'Fixtures', 'Fixtures', '#EF4444', true, true, 1, 'YOUR_COMPANY_ID_HERE'),
  ('YOUR_PLAN_ID_HERE', 'Power', 'Power', '#F59E0B', true, true, 2, 'YOUR_COMPANY_ID_HERE'),
  ('YOUR_PLAN_ID_HERE', 'Branch', 'Branch', '#10B981', true, true, 3, 'YOUR_COMPANY_ID_HERE'),
  ('YOUR_PLAN_ID_HERE', 'Feeders', 'Feeders', '#3B82F6', true, true, 4, 'YOUR_COMPANY_ID_HERE'),
  ('YOUR_PLAN_ID_HERE', 'Switchgear', 'Switchgear', '#8B5CF6', true, true, 5, 'YOUR_COMPANY_ID_HERE'),
  ('YOUR_PLAN_ID_HERE', 'Equipment', 'Equipment', '#EC4899', true, true, 6, 'YOUR_COMPANY_ID_HERE'),
  ('YOUR_PLAN_ID_HERE', 'Special Systems', 'Special Systems', '#06B6D4', true, true, 7, 'YOUR_COMPANY_ID_HERE')
ON CONFLICT DO NOTHING;

-- Verify they were created
SELECT * FROM measurement_layers 
WHERE plan_id = 'YOUR_PLAN_ID_HERE' 
ORDER BY display_order;
