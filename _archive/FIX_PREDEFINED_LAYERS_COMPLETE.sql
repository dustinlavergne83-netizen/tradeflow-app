-- Complete fix for predefined layers
-- This script will ensure the 7 predefined layers exist with correct settings

-- Step 1: First, let's see what we have
SELECT 'BEFORE FIX - Current state of layers:' as status;
SELECT 
  id, plan_id, name, section_name, 
  color, is_predefined, display_order, visible
FROM measurement_layers
ORDER BY plan_id, is_predefined DESC, display_order NULLS LAST;

-- Step 2: Update any existing layers with these names to be predefined
UPDATE measurement_layers
SET 
  is_predefined = TRUE,
  section_name = name, -- Set section_name to match name
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

SELECT 'Step 2 complete: Updated existing layers' as status;

-- Step 3: Get all plan_ids and company_ids to insert missing layers
-- We'll create predefined layers for each plan that doesn't have them yet

WITH plan_info AS (
  SELECT DISTINCT 
    ml.plan_id,
    ml.company_id
  FROM measurement_layers ml
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
  SELECT 
    pi.plan_id,
    pi.company_id,
    pl.name,
    pl.section_name,
    pl.color,
    pl.display_order
  FROM plan_info pi
  CROSS JOIN predefined_layers pl
  WHERE NOT EXISTS (
    SELECT 1 
    FROM measurement_layers ml 
    WHERE ml.plan_id = pi.plan_id 
    AND ml.name = pl.name
    AND ml.is_predefined = TRUE
  )
)
INSERT INTO measurement_layers (plan_id, name, section_name, color, visible, is_predefined, display_order, company_id)
SELECT 
  plan_id,
  name,
  section_name,
  color,
  TRUE as visible,
  TRUE as is_predefined,
  display_order,
  company_id
FROM missing_layers;

SELECT 'Step 3 complete: Inserted missing predefined layers' as status;

-- Step 4: Verify the fix
SELECT 'AFTER FIX - Predefined layers:' as status;
SELECT 
  id, plan_id, name, section_name, 
  color, is_predefined, display_order, visible
FROM measurement_layers
WHERE is_predefined = TRUE
ORDER BY plan_id, display_order;

-- Step 5: Count summary
SELECT 'SUMMARY:' as status;
SELECT 
  plan_id,
  COUNT(*) as total_layers,
  SUM(CASE WHEN is_predefined THEN 1 ELSE 0 END) as predefined_layers,
  SUM(CASE WHEN NOT is_predefined THEN 1 ELSE 0 END) as custom_layers
FROM measurement_layers
GROUP BY plan_id
ORDER BY plan_id;
