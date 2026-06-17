-- ============================================================
-- FIX SHIFTS RLS V2
-- Drops ALL existing INSERT policies on shifts + shift_segments
-- then creates the correct admin-aware policy
-- Run in Supabase → SQL Editor
-- ============================================================

-- Step 1: Drop ALL insert policies on shifts (dynamic — handles any policy name)
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE tablename = 'shifts' AND schemaname = 'public' AND cmd = 'INSERT'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.shifts', pol.policyname);
    RAISE NOTICE 'Dropped policy: %', pol.policyname;
  END LOOP;
END $$;

-- Step 2: Drop ALL insert policies on shift_segments
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE tablename = 'shift_segments' AND schemaname = 'public' AND cmd = 'INSERT'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.shift_segments', pol.policyname);
    RAISE NOTICE 'Dropped policy: %', pol.policyname;
  END LOOP;
END $$;

-- Step 3: Create new insert policy for shifts
-- Allows: own inserts (clock-in) + admin/supervisor inserts (manual punch / paste)
CREATE POLICY "shifts_insert_admin_or_self" ON public.shifts
FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  OR EXISTS (
    SELECT 1 FROM public.employees
    WHERE employees.user_id = auth.uid()
      AND employees.role IN ('admin', 'supervisor')
  )
);

-- Step 4: Create new insert policy for shift_segments
CREATE POLICY "shift_segments_insert_admin_or_self" ON public.shift_segments
FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  OR EXISTS (
    SELECT 1 FROM public.employees
    WHERE employees.user_id = auth.uid()
      AND employees.role IN ('admin', 'supervisor')
  )
);

-- Step 5: Confirm what we have now
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE tablename IN ('shifts', 'shift_segments')
ORDER BY tablename, cmd, policyname;
