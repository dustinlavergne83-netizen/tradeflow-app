-- =====================================================
-- ENABLE EMPLOYEES TO VIEW ALL PROJECTS
-- =====================================================
-- Run this in Supabase Dashboard → SQL Editor
-- This allows authenticated users (employees) to SEE all projects

-- Simple approach: Let all authenticated users view projects
-- (Works for single-company setup where all employees work for you)
CREATE POLICY "Authenticated users can view projects"
  ON projects FOR SELECT
  TO authenticated
  USING (true);

-- ✅ That's it! Now employees can see all projects you create in the web app
-- Note: They can only VIEW, not edit/delete (that's still admin-only)
