-- Fix: Update existing layers to mark them as predefined
-- This will update any layers that match the 7 predefined layer names

UPDATE measurement_layers
SET 
  is_predefined = TRUE,
  section_name = CASE name
    WHEN 'Fixtures' THEN 'Fixtures'
    WHEN 'Power' THEN 'Power'
    WHEN 'Branch' THEN 'Branch'
    WHEN 'Feeders' THEN 'Feeders'
    WHEN 'Switchgear' THEN 'Switchgear'
    WHEN 'Equipment' THEN 'Equipment'
    WHEN 'Special Systems' THEN 'Special Systems'
  END,
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

-- Verify the fix
SELECT id, plan_id, name, section_name, color, is_predefined, display_order, visible
FROM measurement_layers
WHERE name IN ('Fixtures', 'Power', 'Branch', 'Feeders', 'Switchgear', 'Equipment', 'Special Systems')
ORDER BY display_order;
