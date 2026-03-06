-- =====================================================
-- FINAL SUPABASE STORAGE FIX FOR REACT NATIVE UPLOAD ERRORS
-- Run this in your Supabase SQL Editor to fix "Network request failed"
-- =====================================================

-- Step 1: Ensure the bucket exists and is properly configured
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('project-photos', 'project-photos', true, 52428800, ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic'])
ON CONFLICT (id) DO UPDATE SET 
    public = true,
    file_size_limit = 52428800,  -- 50MB limit
    allowed_mime_types = ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic'];

-- Step 2: Drop ALL existing storage policies to start fresh
DROP POLICY IF EXISTS "Anyone can view project photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload project photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update project photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete project photos" ON storage.objects;
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can insert" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can select" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete" ON storage.objects;

-- Step 3: Create the correct RLS policies for project-photos bucket
-- Allow anyone to view/download (SELECT)
CREATE POLICY "Public read access for project photos"
ON storage.objects FOR SELECT
USING (bucket_id = 'project-photos');

-- Allow authenticated users to upload (INSERT)
CREATE POLICY "Authenticated upload for project photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'project-photos');

-- Allow authenticated users to update existing files
CREATE POLICY "Authenticated update for project photos"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'project-photos');

-- Allow authenticated users to delete files
CREATE POLICY "Authenticated delete for project photos"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'project-photos');

-- Step 4: Ensure RLS is enabled on storage.objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Step 5: Grant necessary permissions
GRANT ALL ON storage.buckets TO authenticated;
GRANT ALL ON storage.objects TO authenticated;
GRANT ALL ON storage.buckets TO anon;
GRANT SELECT ON storage.objects TO anon;

-- =====================================================
-- VERIFICATION QUERIES (run these to check setup)
-- =====================================================

-- Check bucket configuration
SELECT id, name, public, file_size_limit, allowed_mime_types 
FROM storage.buckets 
WHERE id = 'project-photos';

-- Check storage policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies 
WHERE schemaname = 'storage' AND tablename = 'objects'
AND policyname LIKE '%project photos%';

-- =====================================================
-- MANUAL VERIFICATION STEPS IN SUPABASE DASHBOARD
-- =====================================================
-- 1. Go to Storage > project-photos bucket
-- 2. Check that "Public bucket" toggle is ON
-- 3. Go to Storage > Policies
-- 4. Verify you see the 4 policies created above
-- 5. Test upload by dragging a file into the bucket manually

COMMIT;