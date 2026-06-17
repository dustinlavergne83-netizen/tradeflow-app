-- ============================================================
-- FIX SHIFTS RLS V3
-- Uses a SECURITY DEFINER function to check admin status
-- (bypasses RLS on employees table inside the policy check)
-- Run in Supabase → SQL Editor
-- ============================================================

-- Step 1: Create a security-definer function that checks if current user is admin/supervisor
-- This bypasses RLS when checking the employees table
CREATE OR REPLACE FUNCTION public.is_admin_or_supervisor()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.employees
    WHERE employees.user_id = auth.uid()
      AND lower(employees.role) IN ('admin', 'supervisor')
  );
$$;

-- Step 2: Drop ALL existing insert policies on shifts (dynamically)
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE tablename = 'shifts' AND schemaname = 'public' AND cmd = 'INSERT'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.shifts', pol.policyname);
    RAISE NOTICE 'Dropped shifts policy: %', pol.policyname;
  END LOOP;
END $$;

-- Step 3: Drop ALL existing insert policies on shift_segments (dynamically)
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE tablename = 'shift_segments' AND schemaname = 'public' AND cmd = 'INSERT'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.shift_segments', pol.policyname);
    RAISE NOTICE 'Dropped shift_segments policy: %', pol.policyname;
  END LOOP;
END $$;

-- Step 4: Create new shifts INSERT policy using the security-definer function
CREATE POLICY "shifts_insert_admin_or_self" ON public.shifts
FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  OR public.is_admin_or_supervisor()
);

-- Step 5: Create new shift_segments INSERT policy using the security-definer function
CREATE POLICY "shift_segments_insert_admin_or_self" ON public.shift_segments
FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  OR public.is_admin_or_supervisor()
);

-- Step 6: Quick sanity check — shows what your role value actually is
SELECT user_id, first_name, last_name, role, lower(role) as role_lower
FROM public.employees
WHERE user_id = auth.uid();

-- Step 7: Confirm new policies are in place
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE tablename IN ('shifts', 'shift_segments')
ORDER BY tablename, cmd, policyname;
