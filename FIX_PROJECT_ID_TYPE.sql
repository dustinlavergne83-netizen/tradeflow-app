-- FINAL FIX: Change project_photos.project_id from UUID to TEXT
-- This fixes the "invalid input syntax for type uuid" error

-- Step 1: Drop the foreign key constraint temporarily
ALTER TABLE project_photos DROP CONSTRAINT IF EXISTS project_photos_project_id_fkey;

-- Step 2: Change project_id column from UUID to TEXT to match projects.id
ALTER TABLE project_photos ALTER COLUMN project_id TYPE text;

-- Step 3: Recreate the foreign key constraint with correct types
ALTER TABLE project_photos 
ADD CONSTRAINT project_photos_project_id_fkey 
FOREIGN KEY (project_id) REFERENCES projects(id);

-- Verify the fix
SELECT 'Fix completed successfully' AS status;