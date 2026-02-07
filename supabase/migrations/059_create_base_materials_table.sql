-- Create base_materials table for the material catalog
CREATE TABLE IF NOT EXISTS base_materials (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  subcategory TEXT,
  unit TEXT NOT NULL DEFAULT 'ea',
  baseCost NUMERIC(10,2) NOT NULL DEFAULT 0,  -- Matches CSV column name
  laborHours NUMERIC(10,4) NOT NULL DEFAULT 0,  -- Matches CSV column name
  price NUMERIC(10,2) GENERATED ALWAYS AS (baseCost) STORED,  -- Alias for compatibility
  labor_hours NUMERIC(10,4) GENERATED ALWAYS AS (laborHours) STORED,  -- Alias for compatibility
  material_type TEXT, -- wire, conduit, box, fixture, etc.
  manufacturer TEXT,
  model_number TEXT,
  upc TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_base_materials_category ON base_materials(category);
CREATE INDEX IF NOT EXISTS idx_base_materials_name ON base_materials(name);
CREATE INDEX IF NOT EXISTS idx_base_materials_active ON base_materials(is_active);
CREATE INDEX IF NOT EXISTS idx_base_materials_type ON base_materials(material_type);

-- Enable full text search on name and description
CREATE INDEX IF NOT EXISTS idx_base_materials_search ON base_materials USING gin(
  to_tsvector('english', name || ' ' || COALESCE(description, ''))
);

-- Create trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION update_base_materials_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS base_materials_updated_at ON base_materials;
CREATE TRIGGER base_materials_updated_at
  BEFORE UPDATE ON base_materials
  FOR EACH ROW
  EXECUTE FUNCTION update_base_materials_updated_at();

-- Grant permissions (adjust based on your RLS policies)
ALTER TABLE base_materials ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Anyone can view base materials" ON base_materials;
DROP POLICY IF EXISTS "Authenticated users can insert base materials" ON base_materials;
DROP POLICY IF EXISTS "Authenticated users can update base materials" ON base_materials;
DROP POLICY IF EXISTS "Authenticated users can delete base materials" ON base_materials;

-- Create policies
CREATE POLICY "Anyone can view base materials"
  ON base_materials
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert base materials"
  ON base_materials
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update base materials"
  ON base_materials
  FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can delete base materials"
  ON base_materials
  FOR DELETE
  TO authenticated
  USING (true);

-- Create a view that combines base_materials and custom_materials
CREATE OR REPLACE VIEW all_materials AS
SELECT 
  id,
  name,
  description,
  category,
  unit,
  price,
  labor_hours,
  'base' as source_type,
  NULL::UUID as company_id,
  is_active,
  created_at,
  updated_at
FROM base_materials
WHERE is_active = true

UNION ALL

SELECT 
  id::TEXT as id,
  name,
  description,
  category,
  unit,
  price,
  labor_hours,
  'custom' as source_type,
  company_id,
  is_active,
  created_at,
  updated_at
FROM custom_materials
WHERE is_active = true;

-- Comment on the table
COMMENT ON TABLE base_materials IS 'Base catalog of materials available to all users. Can be managed through Materials Manager UI.';
