-- Diagnostic query to check predefined layers for your new plan

-- 1. Check all your plans
SELECT id, plan_name, created_at
FROM plans
ORDER BY created_at DESC
LIMIT 5;

-- 2. Check measurement_layers table columns (verify migration applied)
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'measurement_layers'
ORDER BY ordinal_position;

-- 3. Check all layers for your most recent plan
-- Replace <PLAN_ID> with your actual plan ID from step 1
SELECT 
  id,
  plan_id,
  name,
  section_name,
  is_predefined,
  display_order,
  color,
  created_at
FROM measurement_layers
WHERE plan_id IN (
  SELECT id FROM plans ORDER BY created_at DESC LIMIT 1
)
ORDER BY display_order;

-- 4. Count predefined vs custom layers for recent plans
SELECT 
  p.plan_name,
  COUNT(*) FILTER (WHERE ml.is_predefined = TRUE) as predefined_count,
  COUNT(*) FILTER (WHERE ml.is_predefined = FALSE OR ml.is_predefined IS NULL) as custom_count
FROM plans p
LEFT JOIN measurement_layers ml ON ml.plan_id = p.id
WHERE p.created_at > NOW() - INTERVAL '7 days'
GROUP BY p.id, p.plan_name
ORDER BY p.created_at DESC;

-- 5. If no layers exist, manually create them for your newest plan:
-- First, get your plan_id and company_id:
-- SELECT id as plan_id FROM plans ORDER BY created_at DESC LIMIT 1;
-- SELECT id as company_id FROM auth.users LIMIT 1;

-- Then use this to create layers (replace the UUIDs):
/*
INSERT INTO measurement_layers (plan_id, name, section_name, color, visible, is_predefined, display_order, company_id)
VALUES
  ('<YOUR_PLAN_ID>', 'Fixtures', 'Fixtures', '#EF4444', TRUE, TRUE, 1, '<YOUR_COMPANY_ID>'),
  ('<YOUR_PLAN_ID>', 'Power', 'Power', '#F59E0B', TRUE, TRUE, 2, '<YOUR_COMPANY_ID>'),
  ('<YOUR_PLAN_ID>', 'Branch', 'Branch', '#10B981', TRUE, TRUE, 3, '<YOUR_COMPANY_ID>'),
  ('<YOUR_PLAN_ID>', 'Feeders', 'Feeders', '#3B82F6', TRUE, TRUE, 4, '<YOUR_COMPANY_ID>'),
  ('<YOUR_PLAN_ID>', 'Switchgear', 'Switchgear', '#8B5CF6', TRUE, TRUE, 5, '<YOUR_COMPANY_ID>'),
  ('<YOUR_PLAN_ID>', 'Equipment', 'Equipment', '#EC4899', TRUE, TRUE, 6, '<YOUR_COMPANY_ID>'),
  ('<YOUR_PLAN_ID>', 'Special Systems', 'Special Systems', '#06B6D4', TRUE, TRUE, 7, '<YOUR_COMPANY_ID>');
*/
