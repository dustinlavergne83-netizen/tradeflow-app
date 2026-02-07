-- Storage policies for check-stubs bucket
-- Run this in SQL Editor after creating the check-stubs storage bucket

-- Policy 1: Employees can view their own check stubs
CREATE POLICY "Employees can view their own check stubs"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'check-stubs' 
  AND EXISTS (
    SELECT 1 FROM check_stubs cs
    JOIN employees e ON cs.employee_id = e.id
    WHERE e.user_id = auth.uid()
    AND cs.file_path = name
  )
);

-- Policy 2: Admins can upload check stubs
CREATE POLICY "Admins can upload check stubs"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'check-stubs'
  AND EXISTS (
    SELECT 1 FROM employees
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- Policy 3: Admins can view all check stubs
CREATE POLICY "Admins can view all check stubs"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'check-stubs'
  AND EXISTS (
    SELECT 1 FROM employees
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- Policy 4: Admins can delete check stubs
CREATE POLICY "Admins can delete check stubs"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'check-stubs'
  AND EXISTS (
    SELECT 1 FROM employees
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- Policy 5: Admins can update check stubs
CREATE POLICY "Admins can update check stubs"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'check-stubs'
  AND EXISTS (
    SELECT 1 FROM employees
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);
