-- TEMPORARY: Disable RLS to test if that's the issue
-- Run this in Supabase SQL Editor

-- Disable RLS temporarily
ALTER TABLE base_materials DISABLE ROW LEVEL SECURITY;

-- After testing, you can re-enable it with:
-- ALTER TABLE base_materials ENABLE ROW LEVEL SECURITY;
