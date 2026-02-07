-- ============================================================
-- CREATE PREDEFINED LAYERS FOR ALL PLANS
-- This script creates the 7 section layers for all plans that don't have them
-- ============================================================

-- Step 1: Create predefined layers for ALL plans that are missing them
DO $$
DECLARE
  plan_record RECORD;
  layers_created INTEGER;
BEGIN
  -- Loop through all plans
  FOR plan_record IN 
    SELECT p.id as plan_id, p.plan_name, p.company_id
    FROM plans p
    ORDER BY p.created_at DESC
  LOOP
    -- Check if this plan already has predefined layers
    IF NOT EXISTS (
      SELECT 1 FROM measurement_layers 
      WHERE plan_id = plan_record.plan_id 
      AND is_predefined = TRUE
    ) THEN
      -- Create the 7 predefined layers
      INSERT INTO measurement_layers (plan_id, name, section_name, color, visible, is_predefined, display_order, company_id)
      VALUES
        (plan_record.plan_id, 'Fixtures', 'Fixtures', '#EF4444', TRUE, TRUE, 1, plan_record.company_id),
        (plan_record.plan_id, 'Power', 'Power', '#F59E0B', TRUE, TRUE, 2, plan_record.company_id),
        (plan_record.plan_id, 'Branch', 'Branch', '#10B981', TRUE, TRUE, 3, plan_record.company_id),
        (plan_record.plan_id, 'Feeders', 'Feeders', '#3B82F6', TRUE, TRUE, 4, plan_record.company_id),
        (plan_record.plan_id, 'Switchgear', 'Switchgear', '#8B5CF6', TRUE, TRUE, 5, plan_record.company_id),
        (plan_record.plan_id, 'Equipment', 'Equipment', '#EC4899', TRUE, TRUE, 6, plan_record.company_id),
        (plan_record.plan_id, 'Special Systems', 'Special Systems', '#06B6D4', TRUE, TRUE, 7, plan_record.company_id);
      
      RAISE NOTICE '✅ Created 7 predefined layers for plan: % (ID: %)', plan_record.plan_name, plan_record.plan_id;
    ELSE
      RAISE NOTICE '⏭️  Plan "%" already has predefined layers', plan_record.plan_name;
    END IF;
  END LOOP;
  
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ COMPLETED! All plans now have predefined layers.';
  RAISE NOTICE '========================================';
END $$;

-- Step 2: Verify the results
SELECT 
  p.plan_name,
  p.created_at,
  COUNT(*) FILTER (WHERE ml.is_predefined = TRUE) as predefined_layers,
  COUNT(*) FILTER (WHERE ml.is_predefined = FALSE OR ml.is_predefined IS NULL) as custom_layers
FROM plans p
LEFT JOIN measurement_layers ml ON ml.plan_id = p.id
GROUP BY p.id, p.plan_name, p.created_at
ORDER BY p.created_at DESC;
