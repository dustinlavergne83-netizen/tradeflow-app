-- =====================================================
-- SUPABASE STORAGE SETUP FOR PROJECT PHOTOS
-- Run this in your Supabase SQL Editor to fix photo saving
-- =====================================================

-- Create the storage bucket for project photos if it doesn't exist
-- Note: This creates the bucket programmatically, but you may need to 
-- create it manually in the Supabase Dashboard under Storage

INSERT INTO storage.buckets (id, name, public)
VALUES ('project-photos', 'project-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Enable RLS on storage.objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Drop existing storage policies if they exist
DROP POLICY IF EXISTS "Anyone can view project photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload project photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update project photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete project photos" ON storage.objects;

-- Create storage policies for the project-photos bucket

-- 1. Allow anyone to view photos (public read access)
CREATE POLICY "Anyone can view project photos"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'project-photos');

-- 2. Allow authenticated users to upload photos
CREATE POLICY "Authenticated users can upload project photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'project-photos');

-- 3. Allow authenticated users to update photos
CREATE POLICY "Authenticated users can update project photos"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'project-photos');

-- 4. Allow authenticated users to delete photos
CREATE POLICY "Authenticated users can delete project photos"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'project-photos');

-- Grant necessary permissions
GRANT ALL ON storage.buckets TO authenticated;
GRANT ALL ON storage.objects TO authenticated;

-- =====================================================
-- STORAGE BUCKET SETUP COMPLETE!
-- =====================================================

-- MANUAL STEPS (if the above doesn't work):
-- 1. Go to your Supabase Dashboard
-- 2. Navigate to Storage section
-- 3. Click "Create Bucket"
-- 4. Name it: project-photos
-- 5. Set it to Public: true
-- 6. Set these policies in the Storage Policies section:
--    - SELECT: Allow public access
--    - INSERT: Allow authenticated users
--    - UPDATE: Allow authenticated users  
--    - DELETE: Allow authenticated users