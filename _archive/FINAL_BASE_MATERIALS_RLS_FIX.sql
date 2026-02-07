-- FINAL FIX for Base Materials RLS
-- Run this in Supabase SQL Editor

-- Re-enable RLS
ALTER TABLE base_materials ENABLE ROW LEVEL SECURITY;

-- Drop all existing policies
DROP POLICY IF EXISTS "Anyone can view base materials" ON base_materials;
DROP POLICY IF EXISTS "Only admins can insert base materials" ON base_materials;
DROP POLICY IF EXISTS "Only admins can update base materials" ON base_materials;
DROP POLICY IF EXISTS "Only admins can delete base materials" ON base_materials;
DROP POLICY IF EXISTS "base_materials_select" ON base_materials;
DROP POLICY IF EXISTS "base_materials_insert" ON base_materials;
DROP POLICY IF EXISTS "base_materials_update" ON base_materials;
DROP POLICY IF EXISTS "base_materials_delete" ON base_materials;

-- Create new admin-only policies that actually work
CREATE POLICY "base_materials_select_policy" 
  ON base_materials FOR SELECT 
  TO authenticated 
  USING (
    EXISTS (
      SELECT 1 FROM employees
      WHERE employees.id = auth.uid()
      AND employees.role = 'admin'
    )
  );

CREATE POLICY "base_materials_insert_policy" 
  ON base_materials FOR INSERT 
  TO authenticated 
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM employees
      WHERE employees.id = auth.uid()
      AND employees.role = 'admin'
    )
  );

CREATE POLICY "base_materials_update_policy" 
  ON base_materials FOR UPDATE 
  TO authenticated 
  USING (
    EXISTS (
      SELECT 1 FROM employees
      WHERE employees.id = auth.uid()
      AND employees.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM employees
      WHERE employees.id = auth.uid()
      AND employees.role = 'admin'
    )
  );

CREATE POLICY "base_materials_delete_policy" 
  ON base_materials FOR DELETE 
  TO authenticated 
  USING (
    EXISTS (
      SELECT 1 FROM employees
      WHERE employees.id = auth.uid()
      AND employees.role = 'admin'
    )
  );
