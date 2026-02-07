-- Add section_name field to measurement_layers
ALTER TABLE measurement_layers
ADD COLUMN IF NOT EXISTS section_name TEXT,
ADD COLUMN IF NOT EXISTS is_predefined BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS display_order INTEGER;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_measurement_layers_section ON measurement_layers(section_name);
CREATE INDEX IF NOT EXISTS idx_measurement_layers_predefined ON measurement_layers(is_predefined);

-- Update existing layers to not be predefined
UPDATE measurement_layers SET is_predefined = FALSE WHERE is_predefined IS NULL;

-- Function to auto-create predefined layers for a plan
CREATE OR REPLACE FUNCTION create_predefined_layers(p_plan_id UUID, p_company_id UUID)
RETURNS VOID AS $$
BEGIN
  -- Only create if they don't exist
  INSERT INTO measurement_layers (plan_id, name, section_name, color, visible, is_predefined, display_order, company_id)
  SELECT p_plan_id, name, section, color, TRUE, TRUE, ord, p_company_id
  FROM (VALUES
    ('Fixtures', 'Fixtures', '#EF4444', 1),
    ('Power', 'Power', '#F59E0B', 2),
    ('Branch', 'Branch', '#10B981', 3),
    ('Feeders', 'Feeders', '#3B82F6', 4),
    ('Switchgear', 'Switchgear', '#8B5CF6', 5),
    ('Equipment', 'Equipment', '#EC4899', 6),
    ('Special Systems', 'Special Systems', '#06B6D4', 7)
  ) AS predefined(name, section, color, ord)
  WHERE NOT EXISTS (
    SELECT 1 FROM measurement_layers 
    WHERE plan_id = p_plan_id 
    AND section_name = predefined.section
    AND is_predefined = TRUE
  );
END;
$$ LANGUAGE plpgsql;
