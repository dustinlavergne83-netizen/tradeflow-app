-- Fix: Allow admins/supervisors to insert shifts for any employee
-- (needed for the "Paste Time Entry" and "Add Manual Punch" features)
--
-- Run this in Supabase → SQL Editor

-- Drop the existing restrictive insert policy if it exists
DROP POLICY IF EXISTS "Users can insert own shifts" ON public.shifts;
DROP POLICY IF EXISTS "shifts_insert_own" ON public.shifts;
DROP POLICY IF EXISTS "Allow insert for own user_id" ON public.shifts;

-- Create a new policy that allows:
--   1. Employees to insert their own shifts (self clock-in)
--   2. Admins and supervisors to insert shifts for anyone
CREATE POLICY "shifts_insert_policy" ON public.shifts
FOR INSERT
WITH CHECK (
  -- Either inserting for yourself (normal clock-in)
  auth.uid() = user_id
  OR
  -- Or you're an admin or supervisor (manual punch / paste)
  EXISTS (
    SELECT 1 FROM public.employees
    WHERE employees.user_id = auth.uid()
      AND employees.role IN ('admin', 'supervisor')
  )
);

-- Also fix shift_segments insert policy (same issue)
DROP POLICY IF EXISTS "Users can insert own shift_segments" ON public.shift_segments;
DROP POLICY IF EXISTS "shift_segments_insert_own" ON public.shift_segments;
DROP POLICY IF EXISTS "Allow insert for own user_id" ON public.shift_segments;

CREATE POLICY "shift_segments_insert_policy" ON public.shift_segments
FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  OR
  EXISTS (
    SELECT 1 FROM public.employees
    WHERE employees.user_id = auth.uid()
      AND employees.role IN ('admin', 'supervisor')
  )
);

-- Verify the policies were created
SELECT schemaname, tablename, policyname, cmd
FROM pg_policies
WHERE tablename IN ('shifts', 'shift_segments')
  AND cmd = 'INSERT'
ORDER BY tablename, policyname;
