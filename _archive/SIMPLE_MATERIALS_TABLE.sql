-- SIMPLE VERSION - NO GENERATED COLUMNS
-- Run this ENTIRE script in Supabase SQL Editor

-- Drop everything
DROP VIEW IF EXISTS all_materials;
DROP TABLE IF EXISTS base_materials CASCADE;

-- Create table with SIMPLE columns (no generated columns!)
CREATE TABLE base_materials (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  subcategory TEXT,
  unit TEXT NOT NULL DEFAULT 'ea',
  baseCost NUMERIC(10,2) NOT NULL DEFAULT 0,
  laborHours NUMERIC(10,4) NOT NULL DEFAULT 0,
  material_type TEXT,
  manufacturer TEXT,
  model_number TEXT,
  upc TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_base_materials_category ON base_materials(category);
CREATE INDEX idx_base_materials_name ON base_materials(name);
CREATE INDEX idx_base_materials_active ON base_materials(is_active);

-- Create trigger
CREATE OR REPLACE FUNCTION update_base_materials_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER base_materials_updated_at
  BEFORE UPDATE ON base_materials
  FOR EACH ROW
  EXECUTE FUNCTION update_base_materials_updated_at();

-- RLS
ALTER TABLE base_materials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view base materials"
  ON base_materials FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert base materials"
  ON base_materials FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update base materials"
  ON base_materials FOR UPDATE
  TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete base materials"
  ON base_materials FOR DELETE
  TO authenticated USING (true);

-- Create view (using baseCost and laborHours directly)
CREATE VIEW all_materials AS
SELECT 
  id,
  name,
  description,
  category,
  unit,
  baseCost as basecost,
  laborHours as laborhours,
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
  laborhours,
  'custom' as source_type,
  company_id,
  is_active,
  created_at,
  updated_at
FROM custom_materials
WHERE is_active = true;
