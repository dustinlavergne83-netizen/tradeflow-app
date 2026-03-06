-- Add missing columns to measurement_layers table for predefined section layers
ALTER TABLE measurement_layers ADD COLUMN IF NOT EXISTS section_name text;
ALTER TABLE measurement_layers ADD COLUMN IF NOT EXISTS is_predefined boolean DEFAULT false;
ALTER TABLE measurement_layers ADD COLUMN IF NOT EXISTS display_order integer;
ALTER TABLE measurement_layers ADD COLUMN IF NOT EXISTS needs_export boolean DEFAULT true;
ALTER TABLE measurement_layers ADD COLUMN IF NOT EXISTS last_exported_at timestamptz;
ALTER TABLE measurement_layers ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES auth.users(id);

-- Fix RLS policies for measurement_layers
ALTER TABLE measurement_layers ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Users can view their own layers" ON measurement_layers;
DROP POLICY IF EXISTS "Users can insert their own layers" ON measurement_layers;
DROP POLICY IF EXISTS "Users can update their own layers" ON measurement_layers;
DROP POLICY IF EXISTS "Users can delete their own layers" ON measurement_layers;

-- Create permissive policies
CREATE POLICY "Users can view their own layers" ON measurement_layers
  FOR SELECT USING (company_id = auth.uid());

CREATE POLICY "Users can insert their own layers" ON measurement_layers
  FOR INSERT WITH CHECK (company_id = auth.uid());

CREATE POLICY "Users can update their own layers" ON measurement_layers
  FOR UPDATE USING (company_id = auth.uid());

CREATE POLICY "Users can delete their own layers" ON measurement_layers
  FOR DELETE USING (company_id = auth.uid());
