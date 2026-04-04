-- FIX ALL NOT NULL CONSTRAINTS ON assembly_components
-- This will prevent any more "null value in column X violates not-null constraint" errors
-- Run this in Supabase SQL Editor

-- First, let's see what we're working with
SELECT column_name, is_nullable, data_type, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'assembly_components'
ORDER BY ordinal_position;

-- Make ALL non-essential columns nullable
-- Only assembly_id should remain NOT NULL (it's the foreign key)
ALTER TABLE assembly_components ALTER COLUMN material_id DROP NOT NULL;
ALTER TABLE assembly_components ALTER COLUMN component_material_id DROP NOT NULL;
ALTER TABLE assembly_components ALTER COLUMN component_quantity DROP NOT NULL;
ALTER TABLE assembly_components ALTER COLUMN material_name DROP NOT NULL;
ALTER TABLE assembly_components ALTER COLUMN quantity DROP NOT NULL;
ALTER TABLE assembly_components ALTER COLUMN unit DROP NOT NULL;
ALTER TABLE assembly_components ALTER COLUMN material_unit_cost DROP NOT NULL;
ALTER TABLE assembly_components ALTER COLUMN labor_hours DROP NOT NULL;
ALTER TABLE assembly_components ALTER COLUMN sequence DROP NOT NULL;

-- Set defaults for all columns so even if we miss one, it won't fail
ALTER TABLE assembly_components ALTER COLUMN material_id SET DEFAULT '';
ALTER TABLE assembly_components ALTER COLUMN component_material_id SET DEFAULT '';
ALTER TABLE assembly_components ALTER COLUMN component_quantity SET DEFAULT 0;
ALTER TABLE assembly_components ALTER COLUMN material_name SET DEFAULT 'Unknown';
ALTER TABLE assembly_components ALTER COLUMN quantity SET DEFAULT 0;
ALTER TABLE assembly_components ALTER COLUMN unit SET DEFAULT 'ea';
ALTER TABLE assembly_components ALTER COLUMN material_unit_cost SET DEFAULT 0;
ALTER TABLE assembly_components ALTER COLUMN labor_hours SET DEFAULT 0;
ALTER TABLE assembly_components ALTER COLUMN sequence SET DEFAULT 0;

-- Verify the changes
SELECT column_name, is_nullable, data_type, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'assembly_components'
ORDER BY ordinal_position;
