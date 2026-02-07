/* GLOBAL FIX: Add predefined layers to ALL plans in the system
   This script works for ALL plans automatically - no manual editing needed! */

/* Step 1: Update any existing layers with predefined names to have is_predefined = TRUE */
UPDATE measurement_layers
SET 
  is_predefined = TRUE,
  section_name = name,
  display_order = CASE name
    WHEN 'Fixtures' THEN 1
    WHEN 'Power' THEN 2
    WHEN 'Branch' THEN 3
    WHEN 'Feeders' THEN 4
    WHEN 'Switchgear' THEN 5
    WHEN 'Equipment' THEN 6
    WHEN 'Special Systems' THEN 7
  END,
  color = CASE name
    WHEN 'Fixtures' THEN '#EF4444'
    WHEN 'Power' THEN '#F59E0B'
    WHEN 'Branch' THEN '#10B981'
    WHEN 'Feeders' THEN '#3B82F6'
    WHEN 'Switchgear' THEN '#8B5CF6'
    WHEN 'Equipment' THEN '#EC4899'
    WHEN 'Special Systems' THEN '#06B6D4'
  END
WHERE name IN ('Fixtures', 'Power', 'Branch', 'Feeders', 'Switchgear', 'Equipment', 'Special Systems');

/* Step 2: Insert missing predefined layers for ALL plans
   This automatically finds ALL plans and creates the 7 layers for each one */
WITH all_plans AS (
  /* Get ALL plans from the plans table */
  SELECT DISTINCT 
    p.id as plan_id
  FROM plans p
),
predefined_layers AS (
  SELECT * FROM (VALUES
    ('Fixtures', 'Fixtures', '#EF4444', 1),
    ('Power', 'Power', '#F59E0B', 2),
    ('Branch', 'Branch', '#10B981', 3),
    ('Feeders', 'Feeders', '#3B82F6', 4),
    ('Switchgear', 'Switchgear', '#8B5CF6', 5),
    ('Equipment', 'Equipment', '#EC4899', 6),
    ('Special Systems', 'Special Systems', '#06B6D4', 7)
  ) AS t(name, section_name, color, display_order)
),
missing_layers AS (
  /* Find which layers are missing for each plan */
  SELECT 
    ap.plan_id,
    pl.name,
    pl.section_name,
    pl.color,
    pl.display_order
  FROM all_plans ap
  CROSS JOIN predefined_layers pl
  WHERE NOT EXISTS (
    SELECT 1 
    FROM measurement_layers ml 
    WHERE ml.plan_id = ap.plan_id 
    AND ml.section_name = pl.section_name
    AND ml.is_predefined = TRUE
  )
)
INSERT INTO measurement_layers (plan_id, name, section_name, color, visible, is_predefined, display_order)
SELECT 
  plan_id,
  name,
  section_name,
  color,
  TRUE as visible,
  TRUE as is_predefined,
  display_order
FROM missing_layers;

/* Step 3: Show results - all predefined layers across all plans */
SELECT 
  'SUCCESS! Predefined layers by plan:' as message,
  COUNT(*) as total_predefined_layers
FROM measurement_layers
WHERE is_predefined = TRUE;

/* Show breakdown by plan */
SELECT 
  p.plan_name,
  ml.plan_id,
  COUNT(*) as predefined_layer_count
FROM measurement_layers ml
JOIN plans p ON p.id = ml.plan_id
WHERE ml.is_predefined = TRUE
GROUP BY ml.plan_id, p.plan_name
ORDER BY p.plan_name;

/* Show all predefined layers in detail */
SELECT 
  p.plan_name,
  ml.name,
  ml.section_name,
  ml.color,
  ml.display_order,
  ml.visible,
  ml.is_predefined
FROM measurement_layers ml
JOIN plans p ON p.id = ml.plan_id
WHERE ml.is_predefined = TRUE
ORDER BY p.plan_name, ml.display_order;
