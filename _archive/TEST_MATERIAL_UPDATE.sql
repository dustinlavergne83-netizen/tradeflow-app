-- Test if you can update base_materials
-- Run this in Supabase SQL Editor to test permissions

-- First, check current value
SELECT id, name, basecost FROM base_materials WHERE id = 'fish_tape_100' LIMIT 1;

-- Try to update (as your admin user)
UPDATE base_materials 
SET basecost = 99.99 
WHERE id = 'fish_tape_100';

-- Check if it updated
SELECT id, name, basecost FROM base_materials WHERE id = 'fish_tape_100' LIMIT 1;

-- Check RLS policies
SELECT * FROM pg_policies WHERE tablename = 'base_materials';
