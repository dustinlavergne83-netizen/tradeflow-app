-- Update RLS policies for base_materials
-- Only admins (role = 'admin') can INSERT, UPDATE, DELETE
-- Everyone can SELECT (read)

-- Drop existing policies
DROP POLICY IF EXISTS "Authenticated users can insert base materials" ON base_materials;
DROP POLICY IF EXISTS "Authenticated users can update base materials" ON base_materials;
DROP POLICY IF EXISTS "Authenticated users can delete base materials" ON base_materials;

-- Create admin-only write policies
CREATE POLICY "Only admins can insert base materials"
  ON base_materials
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM employees
      WHERE employees.id = auth.uid()
      AND employees.role = 'admin'
    )
  );

CREATE POLICY "Only admins can update base materials"
  ON base_materials
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM employees
      WHERE employees.id = auth.uid()
      AND employees.role = 'admin'
    )
  );

CREATE POLICY "Only admins can delete base materials"
  ON base_materials
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM employees
      WHERE employees.id = auth.uid()
      AND employees.role = 'admin'
    )
  );

-- READ policy stays the same (everyone can read)
-- "Anyone can view base materials" policy already exists
