-- =====================================================
-- Digital Takeoff System - Phase 1: Database Schema
-- Migration: 049_create_digital_takeoff_tables.sql
-- =====================================================

-- ==================== PLANS TABLE ====================
-- Store uploaded construction plans/drawings
CREATE TABLE plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  company_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- File information
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size INTEGER,
  file_type TEXT CHECK (file_type IN ('pdf', 'png', 'jpeg', 'jpg', 'tiff', 'dwg')),
  
  -- Plan metadata
  plan_name TEXT NOT NULL,
  plan_number TEXT,
  plan_type TEXT CHECK (plan_type IN ('architectural', 'electrical', 'mechanical', 'plumbing', 'structural', 'site', 'other')),
  discipline TEXT CHECK (discipline IN ('power', 'lighting', 'branch', 'switchgear', 'feeders', 'equipment', 'special', 'general')),
  sheet_count INTEGER DEFAULT 1,
  
  -- Scale information
  scale_ratio TEXT, -- e.g., "1/4 inch = 1 foot"
  scale_factor DECIMAL(10,4), -- Calculated scale factor (real units per pixel)
  units TEXT DEFAULT 'feet' CHECK (units IN ('feet', 'meters', 'inches', 'yards')),
  
  -- Status tracking
  is_calibrated BOOLEAN DEFAULT false,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'calibrated', 'in_progress', 'completed', 'archived')),
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT plans_project_company_check CHECK (
    (project_id IS NOT NULL AND company_id IS NOT NULL)
  )
);

-- Indexes for plans
CREATE INDEX idx_plans_project ON plans(project_id);
CREATE INDEX idx_plans_company ON plans(company_id);
CREATE INDEX idx_plans_status ON plans(status);
CREATE INDEX idx_plans_created_at ON plans(created_at DESC);

-- Trigger to update updated_at
CREATE TRIGGER plans_updated_at
  BEFORE UPDATE ON plans
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();


-- ==================== TAKEOFF LAYERS TABLE ====================
-- Organize measurements into layers for better organization
CREATE TABLE takeoff_layers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  company_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Layer details
  layer_name TEXT NOT NULL,
  description TEXT,
  color TEXT DEFAULT '#FF6B00', -- Hex color for visual identification
  
  -- Display settings
  is_visible BOOLEAN DEFAULT true,
  is_locked BOOLEAN DEFAULT false,
  opacity DECIMAL(3,2) DEFAULT 0.70 CHECK (opacity >= 0 AND opacity <= 1),
  
  -- Link to estimate section
  estimate_section TEXT CHECK (estimate_section IN ('lighting', 'power', 'branch', 'switchgear', 'feeders', 'equipment', 'special', 'general')),
  
  -- Organization
  display_order INTEGER DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for layers
CREATE INDEX idx_layers_project ON takeoff_layers(project_id);
CREATE INDEX idx_layers_company ON takeoff_layers(company_id);
CREATE INDEX idx_layers_display_order ON takeoff_layers(display_order);

-- Trigger to update updated_at
CREATE TRIGGER takeoff_layers_updated_at
  BEFORE UPDATE ON takeoff_layers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();


-- ==================== PLAN CALIBRATIONS TABLE ====================
-- Store scale calibration data for accurate measurements
CREATE TABLE plan_calibrations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  plan_id UUID REFERENCES plans(id) ON DELETE CASCADE,
  company_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Calibration line points (in pixels on the image)
  start_x DECIMAL(10,2) NOT NULL,
  start_y DECIMAL(10,2) NOT NULL,
  end_x DECIMAL(10,2) NOT NULL,
  end_y DECIMAL(10,2) NOT NULL,
  
  -- Known real-world distance
  known_distance DECIMAL(10,4) NOT NULL CHECK (known_distance > 0),
  known_unit TEXT NOT NULL CHECK (known_unit IN ('feet', 'meters', 'inches', 'yards')),
  
  -- Calculated scale
  pixel_distance DECIMAL(10,2), -- Distance in pixels
  scale_factor DECIMAL(10,6), -- Real units per pixel (known_distance / pixel_distance)
  
  -- Multi-page support
  page_number INTEGER DEFAULT 1 CHECK (page_number > 0),
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  notes TEXT,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for calibrations
CREATE INDEX idx_calibration_plan ON plan_calibrations(plan_id);
CREATE INDEX idx_calibration_active ON plan_calibrations(is_active) WHERE is_active = true;
CREATE INDEX idx_calibration_page ON plan_calibrations(plan_id, page_number);


-- ==================== TAKEOFF MEASUREMENTS TABLE ====================
-- Store individual measurements/counts from plans
CREATE TABLE takeoff_measurements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  plan_id UUID REFERENCES plans(id) ON DELETE CASCADE,
  estimate_id UUID REFERENCES estimates(id) ON DELETE SET NULL,
  company_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  layer_id UUID REFERENCES takeoff_layers(id) ON DELETE SET NULL,
  
  -- Measurement details
  measurement_type TEXT NOT NULL CHECK (measurement_type IN ('length', 'area', 'count', 'volume')),
  measurement_name TEXT NOT NULL,
  description TEXT,
  
  -- Geometric data stored as JSONB for flexibility
  -- For length: { "type": "line", "points": [[x1,y1], [x2,y2]] }
  -- For area: { "type": "polygon", "points": [[x1,y1], [x2,y2], ...] }
  -- For count: { "type": "points", "points": [[x1,y1], [x2,y2], ...] }
  geometry JSONB NOT NULL,
  
  -- Measured values
  raw_value DECIMAL(12,4), -- Pixel/screen measurement
  actual_value DECIMAL(12,4), -- Real-world measurement after scale applied
  unit TEXT CHECK (unit IN ('feet', 'linear feet', 'sq ft', 'cubic yards', 'cubic feet', 'each', 'meters', 'sq meters')),
  
  -- Visual properties for display
  color TEXT DEFAULT '#FF6B00',
  line_weight INTEGER DEFAULT 2 CHECK (line_weight > 0 AND line_weight <= 10),
  opacity DECIMAL(3,2) DEFAULT 0.70 CHECK (opacity >= 0 AND opacity <= 1),
  
  -- Linking to estimate items
  material_name TEXT, -- Material/item this measurement represents
  section TEXT CHECK (section IN ('lighting', 'power', 'branch', 'switchgear', 'feeders', 'equipment', 'special', 'general')),
  quantity DECIMAL(12,4), -- Calculated quantity for estimate
  
  -- Formula support for complex calculations
  formula TEXT, -- e.g., "length * 2 + 10" for waste calculations
  
  -- Organization
  layer_name TEXT, -- Group measurements by layer (legacy field)
  page_number INTEGER DEFAULT 1 CHECK (page_number > 0),
  
  -- Status
  is_linked BOOLEAN DEFAULT false, -- True if linked to estimate item
  notes TEXT,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for measurements
CREATE INDEX idx_takeoff_plan ON takeoff_measurements(plan_id);
CREATE INDEX idx_takeoff_estimate ON takeoff_measurements(estimate_id);
CREATE INDEX idx_takeoff_company ON takeoff_measurements(company_id);
CREATE INDEX idx_takeoff_layer_id ON takeoff_measurements(layer_id);
CREATE INDEX idx_takeoff_layer_name ON takeoff_measurements(layer_name);
CREATE INDEX idx_takeoff_type ON takeoff_measurements(measurement_type);
CREATE INDEX idx_takeoff_section ON takeoff_measurements(section);
CREATE INDEX idx_takeoff_linked ON takeoff_measurements(is_linked);
CREATE INDEX idx_takeoff_page ON takeoff_measurements(plan_id, page_number);
CREATE INDEX idx_takeoff_geometry ON takeoff_measurements USING GIN (geometry);

-- Trigger to update updated_at
CREATE TRIGGER takeoff_measurements_updated_at
  BEFORE UPDATE ON takeoff_measurements
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();


-- ==================== ROW LEVEL SECURITY (RLS) ====================

-- Enable RLS on all tables
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE takeoff_layers ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_calibrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE takeoff_measurements ENABLE ROW LEVEL SECURITY;

-- Plans Policies
CREATE POLICY "Users can view their own plans"
  ON plans FOR SELECT
  TO authenticated
  USING (company_id = auth.uid());

CREATE POLICY "Users can insert their own plans"
  ON plans FOR INSERT
  TO authenticated
  WITH CHECK (company_id = auth.uid());

CREATE POLICY "Users can update their own plans"
  ON plans FOR UPDATE
  TO authenticated
  USING (company_id = auth.uid())
  WITH CHECK (company_id = auth.uid());

CREATE POLICY "Users can delete their own plans"
  ON plans FOR DELETE
  TO authenticated
  USING (company_id = auth.uid());

-- Takeoff Layers Policies
CREATE POLICY "Users can view their own layers"
  ON takeoff_layers FOR SELECT
  TO authenticated
  USING (company_id = auth.uid());

CREATE POLICY "Users can insert their own layers"
  ON takeoff_layers FOR INSERT
  TO authenticated
  WITH CHECK (company_id = auth.uid());

CREATE POLICY "Users can update their own layers"
  ON takeoff_layers FOR UPDATE
  TO authenticated
  USING (company_id = auth.uid())
  WITH CHECK (company_id = auth.uid());

CREATE POLICY "Users can delete their own layers"
  ON takeoff_layers FOR DELETE
  TO authenticated
  USING (company_id = auth.uid());

-- Plan Calibrations Policies
CREATE POLICY "Users can view their own calibrations"
  ON plan_calibrations FOR SELECT
  TO authenticated
  USING (company_id = auth.uid());

CREATE POLICY "Users can insert their own calibrations"
  ON plan_calibrations FOR INSERT
  TO authenticated
  WITH CHECK (company_id = auth.uid());

CREATE POLICY "Users can update their own calibrations"
  ON plan_calibrations FOR UPDATE
  TO authenticated
  USING (company_id = auth.uid())
  WITH CHECK (company_id = auth.uid());

CREATE POLICY "Users can delete their own calibrations"
  ON plan_calibrations FOR DELETE
  TO authenticated
  USING (company_id = auth.uid());

-- Takeoff Measurements Policies
CREATE POLICY "Users can view their own measurements"
  ON takeoff_measurements FOR SELECT
  TO authenticated
  USING (company_id = auth.uid());

CREATE POLICY "Users can insert their own measurements"
  ON takeoff_measurements FOR INSERT
  TO authenticated
  WITH CHECK (company_id = auth.uid());

CREATE POLICY "Users can update their own measurements"
  ON takeoff_measurements FOR UPDATE
  TO authenticated
  USING (company_id = auth.uid())
  WITH CHECK (company_id = auth.uid());

CREATE POLICY "Users can delete their own measurements"
  ON takeoff_measurements FOR DELETE
  TO authenticated
  USING (company_id = auth.uid());


-- ==================== HELPER FUNCTIONS ====================

-- Function to get total measurements count for a plan
CREATE OR REPLACE FUNCTION get_plan_measurement_count(plan_uuid UUID)
RETURNS INTEGER AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)::INTEGER
    FROM takeoff_measurements
    WHERE plan_id = plan_uuid
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get plan summary statistics
CREATE OR REPLACE FUNCTION get_plan_summary(plan_uuid UUID)
RETURNS TABLE (
  total_measurements INTEGER,
  total_length DECIMAL(12,4),
  total_area DECIMAL(12,4),
  total_count INTEGER,
  linked_measurements INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*)::INTEGER as total_measurements,
    COALESCE(SUM(CASE WHEN measurement_type = 'length' THEN actual_value ELSE 0 END), 0) as total_length,
    COALESCE(SUM(CASE WHEN measurement_type = 'area' THEN actual_value ELSE 0 END), 0) as total_area,
    COALESCE(SUM(CASE WHEN measurement_type = 'count' THEN actual_value ELSE 0 END), 0)::INTEGER as total_count,
    COUNT(CASE WHEN is_linked THEN 1 END)::INTEGER as linked_measurements
  FROM takeoff_measurements
  WHERE plan_id = plan_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to auto-calculate scale factor when calibration is added
CREATE OR REPLACE FUNCTION calculate_calibration_scale()
RETURNS TRIGGER AS $$
BEGIN
  -- Calculate pixel distance using Pythagorean theorem
  NEW.pixel_distance := SQRT(
    POWER(NEW.end_x - NEW.start_x, 2) + 
    POWER(NEW.end_y - NEW.start_y, 2)
  );
  
  -- Calculate scale factor (real units per pixel)
  IF NEW.pixel_distance > 0 THEN
    NEW.scale_factor := NEW.known_distance / NEW.pixel_distance;
  ELSE
    NEW.scale_factor := 0;
  END IF;
  
  -- Update the plan's calibration status
  UPDATE plans 
  SET 
    is_calibrated = true,
    scale_factor = NEW.scale_factor,
    units = NEW.known_unit,
    updated_at = NOW()
  WHERE id = NEW.plan_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-calculate scale factor
CREATE TRIGGER calibration_calculate_scale
  BEFORE INSERT OR UPDATE ON plan_calibrations
  FOR EACH ROW
  EXECUTE FUNCTION calculate_calibration_scale();


-- ==================== COMMENTS ====================

COMMENT ON TABLE plans IS 'Stores uploaded construction plans and drawings';
COMMENT ON TABLE takeoff_layers IS 'Organizes measurements into logical layers';
COMMENT ON TABLE plan_calibrations IS 'Stores scale calibration data for accurate measurements';
COMMENT ON TABLE takeoff_measurements IS 'Stores individual measurements taken from plans';

COMMENT ON COLUMN plans.scale_factor IS 'Calculated scale factor in real units per pixel';
COMMENT ON COLUMN plan_calibrations.scale_factor IS 'Real units per pixel (known_distance / pixel_distance)';
COMMENT ON COLUMN takeoff_measurements.geometry IS 'JSONB storing geometric data - flexible for different measurement types';
COMMENT ON COLUMN takeoff_measurements.raw_value IS 'Measurement in pixels before scale conversion';
COMMENT ON COLUMN takeoff_measurements.actual_value IS 'Real-world measurement after applying scale factor';
