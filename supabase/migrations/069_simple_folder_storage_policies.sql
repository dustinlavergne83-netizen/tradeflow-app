-- Simple folder-based check stubs storage policies
-- Each employee has a folder: check-stubs/EmployeeName/
-- Just drop PDFs in their folder and they'll see them in the app

-- First, remove any existing policies on storage.objects for check-stubs bucket
DROP POLICY IF EXISTS "Employees can view their own check stubs" ON storage.objects;
DROP POLICY IF EXISTS "Admins can upload check stubs" ON storage.objects;
DROP POLICY IF EXISTS "Admins can view all check stubs" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete check stubs" ON storage.objects;
DROP POLICY IF EXISTS "Admins can update check stubs" ON storage.objects;

-- Policy 1: Employees can view files in their own folder
-- Folder structure: check-stubs/FirstName_LastName/file.pdf
CREATE POLICY "Employees can view files in their folder"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'check-stubs' 
  AND (
    -- Employee can see their own folder
    name LIKE (
      SELECT CONCAT(first_name, '_', last_name, '/%')
      FROM employees
      WHERE user_id = auth.uid()
    )
    OR
    -- Admins can see everything
    EXISTS (
      SELECT 1 FROM employees
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  )
);

-- Policy 2: Admins can upload to any folder
CREATE POLICY "Admins can upload to any folder"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'check-stubs'
  AND EXISTS (
    SELECT 1 FROM employees
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- Policy 3: Admins can delete from any folder
CREATE POLICY "Admins can delete from any folder"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'check-stubs'
  AND EXISTS (
    SELECT 1 FROM employees
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- Policy 4: Admins can update any file
CREATE POLICY "Admins can update any file"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'check-stubs'
  AND EXISTS (
    SELECT 1 FROM employees
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- Note: The check_stubs table is now optional
-- You can still use it for tracking, or just rely on folder storage
