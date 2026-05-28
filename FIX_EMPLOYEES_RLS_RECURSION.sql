-- ============================================================
-- FULL FIX v4: Run each block SEPARATELY in Supabase SQL Editor
-- Copy/paste each section one at a time and click RUN
-- ============================================================

-- ══════════════════════════════════════════════════════════════
-- BLOCK 1: Run this first — see ALL current policies
-- ══════════════════════════════════════════════════════════════
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE tablename IN ('employees', 'employee_push_tokens')
ORDER BY tablename, policyname;


-- ══════════════════════════════════════════════════════════════
-- BLOCK 2: Run this second — drop ALL policies on employees
-- ══════════════════════════════════════════════════════════════
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT policyname FROM pg_policies 
           WHERE tablename = 'employees' AND schemaname = 'public'
  LOOP
    EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(r.policyname) || ' ON employees';
  END LOOP;
END $$;


-- ══════════════════════════════════════════════════════════════
-- BLOCK 3: Run this third — drop ALL policies on employee_push_tokens
-- ══════════════════════════════════════════════════════════════
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT policyname FROM pg_policies 
           WHERE tablename = 'employee_push_tokens' AND schemaname = 'public'
  LOOP
    EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(r.policyname) || ' ON employee_push_tokens';
  END LOOP;
END $$;


-- ══════════════════════════════════════════════════════════════
-- BLOCK 4: Run this fourth — create ULTRA-SIMPLE employees policy
-- Just "are you logged in?" — zero cross-table queries, zero recursion possible
-- ══════════════════════════════════════════════════════════════
CREATE POLICY "auth_only"
  ON employees FOR ALL
  TO authenticated
  USING (auth.uid() IS NOT NULL);


-- ══════════════════════════════════════════════════════════════
-- BLOCK 5: Run this fifth — create ULTRA-SIMPLE push token policies
-- ══════════════════════════════════════════════════════════════
CREATE POLICY "push_tokens_self"
  ON employee_push_tokens FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);


-- ══════════════════════════════════════════════════════════════
-- BLOCK 6: Run this last — verify it worked
-- ══════════════════════════════════════════════════════════════
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE tablename IN ('employees', 'employee_push_tokens')
ORDER BY tablename, policyname;

SELECT id, first_name, last_name, role FROM employees ORDER BY first_name;
