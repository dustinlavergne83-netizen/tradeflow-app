-- Check current RLS policies on assembly_components
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'assembly_components';

-- If no policies exist or they're blocking reads, add this:
-- Enable RLS (if not already enabled)
ALTER TABLE assembly_components ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they're wrong
DROP POLICY IF EXISTS "Users can view assembly components" ON assembly_components;
DROP POLICY IF EXISTS "Users can manage assembly components" ON assembly_components;

-- Create proper policies
-- IMPORTANT: Allow ALL authenticated users to READ assembly components
CREATE POLICY "Anyone can view assembly components"
  ON assembly_components
  FOR SELECT
  TO authenticated
  USING (true);

-- Only allow users to INSERT/UPDATE/DELETE their own company's assemblies
CREATE POLICY "Users can manage their assembly components"
  ON assembly_components
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM assemblies
      WHERE assemblies.id = assembly_components.assembly_id
      AND assemblies.company_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM assemblies
      WHERE assemblies.id = assembly_components.assembly_id
      AND assemblies.company_id = auth.uid()
    )
  );
