-- Drop existing tables if they exist (clean slate)
DROP TABLE IF EXISTS assembly_components CASCADE;
DROP TABLE IF EXISTS assemblies CASCADE;

-- Create assemblies table
CREATE TABLE assemblies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT DEFAULT 'ASSEMBLIES',
  unit TEXT DEFAULT 'ea',
  total_material_cost DECIMAL(10,2) DEFAULT 0,
  total_labor_hours DECIMAL(10,2) DEFAULT 0,
  is_custom BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create assembly_components table
CREATE TABLE assembly_components (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assembly_id UUID REFERENCES assemblies(id) ON DELETE CASCADE,
  material_id TEXT NOT NULL,
  material_name TEXT NOT NULL,
  quantity DECIMAL(10,2) NOT NULL DEFAULT 1,
  unit TEXT DEFAULT 'ea',
  material_unit_cost DECIMAL(10,2) DEFAULT 0,
  labor_hours DECIMAL(10,2) DEFAULT 0,
  sequence INTEGER DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create indexes (drop first if they exist)
DROP INDEX IF EXISTS idx_assemblies_company;
DROP INDEX IF EXISTS idx_assemblies_category;
DROP INDEX IF EXISTS idx_assembly_components_assembly;
DROP INDEX IF EXISTS idx_assembly_components_sequence;

CREATE INDEX idx_assemblies_company ON assemblies(company_id);
CREATE INDEX idx_assemblies_category ON assemblies(category);
CREATE INDEX idx_assembly_components_assembly ON assembly_components(assembly_id);
CREATE INDEX idx_assembly_components_sequence ON assembly_components(assembly_id, sequence);

-- Enable Row Level Security
ALTER TABLE assemblies ENABLE ROW LEVEL SECURITY;
ALTER TABLE assembly_components ENABLE ROW LEVEL SECURITY;

-- RLS Policies for assemblies
CREATE POLICY "Users can view all assemblies"
  ON assemblies FOR SELECT
  USING (true); -- All users can see predefined assemblies

CREATE POLICY "Users can create assemblies for their company"
  ON assemblies FOR INSERT
  WITH CHECK (auth.uid() = company_id);

CREATE POLICY "Users can update their own assemblies"
  ON assemblies FOR UPDATE
  USING (auth.uid() = company_id OR is_custom = false); -- Can update own or predefined

CREATE POLICY "Users can delete their own custom assemblies"
  ON assemblies FOR DELETE
  USING (auth.uid() = company_id AND is_custom = true);

-- RLS Policies for assembly_components
CREATE POLICY "Users can view all assembly components"
  ON assembly_components FOR SELECT
  USING (true);

CREATE POLICY "Users can manage components for their assemblies"
  ON assembly_components FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM assemblies
      WHERE assemblies.id = assembly_components.assembly_id
      AND (assemblies.company_id = auth.uid() OR assemblies.is_custom = false)
    )
  );

-- Function to calculate assembly totals
CREATE OR REPLACE FUNCTION calculate_assembly_totals()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE assemblies
  SET 
    total_material_cost = (
      SELECT COALESCE(SUM(quantity * material_unit_cost), 0)
      FROM assembly_components
      WHERE assembly_id = NEW.assembly_id
    ),
    total_labor_hours = (
      SELECT COALESCE(SUM(quantity * labor_hours), 0)
      FROM assembly_components
      WHERE assembly_id = NEW.assembly_id
    ),
    updated_at = now()
  WHERE id = NEW.assembly_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-calculate totals when components change
CREATE TRIGGER recalculate_assembly_totals
AFTER INSERT OR UPDATE OR DELETE ON assembly_components
FOR EACH ROW
EXECUTE FUNCTION calculate_assembly_totals();

-- Create function to duplicate assembly for customization
CREATE OR REPLACE FUNCTION duplicate_assembly(
  source_assembly_id UUID,
  new_name TEXT,
  user_company_id UUID
) RETURNS UUID AS $$
DECLARE
  new_assembly_id UUID;
BEGIN
  -- Create the new assembly
  INSERT INTO assemblies (
    company_id, name, description, category, unit,
    total_material_cost, total_labor_hours, is_custom
  )
  SELECT 
    user_company_id, new_name, description, category, unit,
    total_material_cost, total_labor_hours, true
  FROM assemblies
  WHERE id = source_assembly_id
  RETURNING id INTO new_assembly_id;
  
  -- Copy the components
  INSERT INTO assembly_components (
    assembly_id, material_id, material_name, quantity, unit,
    material_unit_cost, labor_hours, sequence, notes
  )
  SELECT 
    new_assembly_id, material_id, material_name, quantity, unit,
    material_unit_cost, labor_hours, sequence, notes
  FROM assembly_components
  WHERE assembly_id = source_assembly_id;
  
  RETURN new_assembly_id;
END;
$$ LANGUAGE plpgsql;
