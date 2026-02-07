-- Fix UPDATE policy for base_materials
-- The UPDATE policy needs WITH CHECK clause too

DROP POLICY IF EXISTS "Only admins can update base materials" ON base_materials;

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
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM employees
      WHERE employees.id = auth.uid()
      AND employees.role = 'admin'
    )
  );
