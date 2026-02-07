-- Create plan_calibrations table
CREATE TABLE IF NOT EXISTS plan_calibrations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  plan_id UUID REFERENCES plans(id) ON DELETE CASCADE UNIQUE NOT NULL,
  scale_numerator INTEGER NOT NULL,
  scale_denominator INTEGER NOT NULL,
  unit TEXT NOT NULL DEFAULT 'inch',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add RLS policies
ALTER TABLE plan_calibrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view calibrations for their company's plans"
  ON plan_calibrations FOR SELECT
  USING (
    plan_id IN (
      SELECT id FROM plans 
      WHERE project_id IN (
        SELECT id FROM projects 
        WHERE company_id = (SELECT company_id FROM employees WHERE id = auth.uid())
      )
    )
  );

CREATE POLICY "Users can insert calibrations for their company's plans"
  ON plan_calibrations FOR INSERT
  WITH CHECK (
    plan_id IN (
      SELECT id FROM plans 
      WHERE project_id IN (
        SELECT id FROM projects 
        WHERE company_id = (SELECT company_id FROM employees WHERE id = auth.uid())
      )
    )
  );

CREATE POLICY "Users can update calibrations for their company's plans"
  ON plan_calibrations FOR UPDATE
  USING (
    plan_id IN (
      SELECT id FROM plans 
      WHERE project_id IN (
        SELECT id FROM projects 
        WHERE company_id = (SELECT company_id FROM employees WHERE id = auth.uid())
      )
    )
  );

-- Create index for faster lookups
CREATE INDEX idx_plan_calibrations_plan_id ON plan_calibrations(plan_id);

-- Add comment
COMMENT ON TABLE plan_calibrations IS 'Stores scale calibration data for construction plans (e.g., 1/4" = 1 foot)';
