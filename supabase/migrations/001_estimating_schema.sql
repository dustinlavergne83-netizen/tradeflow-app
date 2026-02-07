-- ====================================
-- ESTIMATING SYSTEM DATABASE SCHEMA
-- ====================================

-- Equipment catalog (tools, lifts, vehicles)
CREATE TABLE equipment (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  hourly_rate DECIMAL(10,2) DEFAULT 0,
  daily_rate DECIMAL(10,2) DEFAULT 0,
  weekly_rate DECIMAL(10,2) DEFAULT 0,
  category TEXT, -- 'Lifts', 'Tools', 'Vehicles', etc.
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Assemblies (pre-built groups of materials/labor/equipment)
CREATE TABLE assemblies (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  unit TEXT DEFAULT 'ea', -- 'ea', 'lf', 'sf', etc.
  category TEXT, -- 'Rough-In', 'Finish', 'Service', etc.
  production_rate DECIMAL(10,4), -- units per hour
  waste_factor DECIMAL(5,2) DEFAULT 0, -- percentage (e.g., 5 = 5%)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Assembly line items (materials/labor/equipment in an assembly)
CREATE TABLE assembly_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  assembly_id UUID REFERENCES assemblies(id) ON DELETE CASCADE,
  item_type TEXT NOT NULL, -- 'material', 'labor', 'equipment'
  
  -- Material fields
  material_id TEXT, -- reference to materials CSV or future materials table
  material_name TEXT,
  material_cost DECIMAL(10,2) DEFAULT 0,
  
  -- Labor fields
  labor_description TEXT,
  labor_hours DECIMAL(10,4) DEFAULT 0,
  labor_rate DECIMAL(10,2) DEFAULT 0,
  
  -- Equipment fields
  equipment_id UUID REFERENCES equipment(id) ON DELETE SET NULL,
  equipment_hours DECIMAL(10,4) DEFAULT 0,
  
  quantity DECIMAL(10,4) DEFAULT 1, -- qty per assembly unit
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Estimates (main estimate header)
CREATE TABLE estimates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Project Info
  estimate_number TEXT,
  project_name TEXT NOT NULL,
  customer_name TEXT,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  project_location TEXT,
  
  -- Dates
  estimate_date DATE DEFAULT CURRENT_DATE,
  valid_until DATE,
  
  -- Labor rates
  default_labor_rate DECIMAL(10,2) DEFAULT 85,
  
  -- Markups
  overhead_percent DECIMAL(5,2) DEFAULT 10,
  profit_percent DECIMAL(5,2) DEFAULT 15,
  
  -- Totals (calculated)
  material_subtotal DECIMAL(12,2) DEFAULT 0,
  labor_subtotal DECIMAL(12,2) DEFAULT 0,
  equipment_subtotal DECIMAL(12,2) DEFAULT 0,
  subcontractor_subtotal DECIMAL(12,2) DEFAULT 0,
  subtotal DECIMAL(12,2) DEFAULT 0,
  overhead_amount DECIMAL(12,2) DEFAULT 0,
  profit_amount DECIMAL(12,2) DEFAULT 0,
  total DECIMAL(12,2) DEFAULT 0,
  
  -- Status
  status TEXT DEFAULT 'draft', -- 'draft', 'sent', 'approved', 'rejected'
  notes TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Estimate line items
CREATE TABLE estimate_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  estimate_id UUID REFERENCES estimates(id) ON DELETE CASCADE,
  
  line_type TEXT NOT NULL, -- 'material', 'assembly', 'subcontractor', 'labor_only', 'equipment_only'
  sequence INTEGER DEFAULT 0, -- for ordering
  
  -- Basic info
  description TEXT NOT NULL,
  quantity DECIMAL(10,4) DEFAULT 1,
  unit TEXT DEFAULT 'ea',
  
  -- Material pricing
  material_unit_cost DECIMAL(10,2) DEFAULT 0,
  material_total DECIMAL(12,2) DEFAULT 0,
  waste_factor DECIMAL(5,2) DEFAULT 0,
  
  -- Labor pricing
  labor_hours DECIMAL(10,4) DEFAULT 0,
  labor_rate DECIMAL(10,2) DEFAULT 0,
  labor_total DECIMAL(12,2) DEFAULT 0,
  production_rate DECIMAL(10,4), -- for calculating labor hours
  
  -- Equipment pricing
  equipment_id UUID REFERENCES equipment(id) ON DELETE SET NULL,
  equipment_hours DECIMAL(10,4) DEFAULT 0,
  equipment_rate DECIMAL(10,2) DEFAULT 0,
  equipment_total DECIMAL(12,2) DEFAULT 0,
  
  -- Subcontractor
  subcontractor_name TEXT,
  subcontractor_cost DECIMAL(12,2) DEFAULT 0,
  
  -- Assembly reference
  assembly_id UUID REFERENCES assemblies(id) ON DELETE SET NULL,
  
  -- Line total
  line_total DECIMAL(12,2) DEFAULT 0,
  
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_equipment_company ON equipment(company_id);
CREATE INDEX idx_assemblies_company ON assemblies(company_id);
CREATE INDEX idx_assembly_items_assembly ON assembly_items(assembly_id);
CREATE INDEX idx_estimates_company ON estimates(company_id);
CREATE INDEX idx_estimates_customer ON estimates(customer_id);
CREATE INDEX idx_estimate_items_estimate ON estimate_items(estimate_id);

-- Enable Row Level Security
ALTER TABLE equipment ENABLE ROW LEVEL SECURITY;
ALTER TABLE assemblies ENABLE ROW LEVEL SECURITY;
ALTER TABLE assembly_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE estimates ENABLE ROW LEVEL SECURITY;
ALTER TABLE estimate_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies for equipment
CREATE POLICY "Users can view their own equipment"
  ON equipment FOR SELECT
  USING (auth.uid() = company_id);

CREATE POLICY "Users can insert their own equipment"
  ON equipment FOR INSERT
  WITH CHECK (auth.uid() = company_id);

CREATE POLICY "Users can update their own equipment"
  ON equipment FOR UPDATE
  USING (auth.uid() = company_id);

CREATE POLICY "Users can delete their own equipment"
  ON equipment FOR DELETE
  USING (auth.uid() = company_id);

-- RLS Policies for assemblies
CREATE POLICY "Users can view their own assemblies"
  ON assemblies FOR SELECT
  USING (auth.uid() = company_id);

CREATE POLICY "Users can insert their own assemblies"
  ON assemblies FOR INSERT
  WITH CHECK (auth.uid() = company_id);

CREATE POLICY "Users can update their own assemblies"
  ON assemblies FOR UPDATE
  USING (auth.uid() = company_id);

CREATE POLICY "Users can delete their own assemblies"
  ON assemblies FOR DELETE
  USING (auth.uid() = company_id);

-- RLS Policies for assembly_items
CREATE POLICY "Users can view assembly items"
  ON assembly_items FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM assemblies 
    WHERE assemblies.id = assembly_items.assembly_id 
    AND assemblies.company_id = auth.uid()
  ));

CREATE POLICY "Users can insert assembly items"
  ON assembly_items FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM assemblies 
    WHERE assemblies.id = assembly_items.assembly_id 
    AND assemblies.company_id = auth.uid()
  ));

CREATE POLICY "Users can update assembly items"
  ON assembly_items FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM assemblies 
    WHERE assemblies.id = assembly_items.assembly_id 
    AND assemblies.company_id = auth.uid()
  ));

CREATE POLICY "Users can delete assembly items"
  ON assembly_items FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM assemblies 
    WHERE assemblies.id = assembly_items.assembly_id 
    AND assemblies.company_id = auth.uid()
  ));

-- RLS Policies for estimates
CREATE POLICY "Users can view their own estimates"
  ON estimates FOR SELECT
  USING (auth.uid() = company_id);

CREATE POLICY "Users can insert their own estimates"
  ON estimates FOR INSERT
  WITH CHECK (auth.uid() = company_id);

CREATE POLICY "Users can update their own estimates"
  ON estimates FOR UPDATE
  USING (auth.uid() = company_id);

CREATE POLICY "Users can delete their own estimates"
  ON estimates FOR DELETE
  USING (auth.uid() = company_id);

-- RLS Policies for estimate_items
CREATE POLICY "Users can view estimate items"
  ON estimate_items FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM estimates 
    WHERE estimates.id = estimate_items.estimate_id 
    AND estimates.company_id = auth.uid()
  ));

CREATE POLICY "Users can insert estimate items"
  ON estimate_items FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM estimates 
    WHERE estimates.id = estimate_items.estimate_id 
    AND estimates.company_id = auth.uid()
  ));

CREATE POLICY "Users can update estimate items"
  ON estimate_items FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM estimates 
    WHERE estimates.id = estimate_items.estimate_id 
    AND estimates.company_id = auth.uid()
  ));

CREATE POLICY "Users can delete estimate items"
  ON estimate_items FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM estimates 
    WHERE estimates.id = estimate_items.estimate_id 
    AND estimates.company_id = auth.uid()
  ));

-- Function to update estimate totals
CREATE OR REPLACE FUNCTION update_estimate_totals()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE estimates
  SET
    material_subtotal = (
      SELECT COALESCE(SUM(material_total), 0)
      FROM estimate_items
      WHERE estimate_id = NEW.estimate_id
    ),
    labor_subtotal = (
      SELECT COALESCE(SUM(labor_total), 0)
      FROM estimate_items
      WHERE estimate_id = NEW.estimate_id
    ),
    equipment_subtotal = (
      SELECT COALESCE(SUM(equipment_total), 0)
      FROM estimate_items
      WHERE estimate_id = NEW.estimate_id
    ),
    subcontractor_subtotal = (
      SELECT COALESCE(SUM(subcontractor_cost), 0)
      FROM estimate_items
      WHERE estimate_id = NEW.estimate_id
    ),
    subtotal = (
      SELECT COALESCE(SUM(line_total), 0)
      FROM estimate_items
      WHERE estimate_id = NEW.estimate_id
    ),
    updated_at = NOW()
  WHERE id = NEW.estimate_id;
  
  -- Calculate overhead and profit
  UPDATE estimates
  SET
    overhead_amount = subtotal * (overhead_percent / 100),
    profit_amount = subtotal * (profit_percent / 100)
  WHERE id = NEW.estimate_id;
  
  -- Calculate final total
  UPDATE estimates
  SET total = subtotal + overhead_amount + profit_amount
  WHERE id = NEW.estimate_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update estimate totals
CREATE TRIGGER estimate_items_update_totals
AFTER INSERT OR UPDATE OR DELETE ON estimate_items
FOR EACH ROW
EXECUTE FUNCTION update_estimate_totals();
