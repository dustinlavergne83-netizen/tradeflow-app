-- ============================================================
-- FIX employee_push_tokens TABLE
-- Run this in Supabase SQL Editor if push tokens aren't saving
-- ============================================================

-- 1. Create the table (if it doesn't exist)
CREATE TABLE IF NOT EXISTS employee_push_tokens (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  expo_push_token  TEXT NOT NULL,
  device_name      TEXT,
  updated_at       TIMESTAMPTZ DEFAULT now(),
  created_at       TIMESTAMPTZ DEFAULT now()
);

-- 2. Add the unique constraint the upsert depends on
--    (safe to run even if it already exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'employee_push_tokens_user_id_expo_push_token_key'
  ) THEN
    ALTER TABLE employee_push_tokens
      ADD CONSTRAINT employee_push_tokens_user_id_expo_push_token_key
      UNIQUE (user_id, expo_push_token);
  END IF;
END $$;

-- 3. Enable RLS
ALTER TABLE employee_push_tokens ENABLE ROW LEVEL SECURITY;

-- 4. Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Users can insert their own push token"    ON employee_push_tokens;
DROP POLICY IF EXISTS "Users can update their own push token"    ON employee_push_tokens;
DROP POLICY IF EXISTS "Users can select their own push tokens"   ON employee_push_tokens;
DROP POLICY IF EXISTS "Admins can read all push tokens"          ON employee_push_tokens;
DROP POLICY IF EXISTS "Service role full access"                 ON employee_push_tokens;

-- 5. Allow authenticated users to insert/update THEIR OWN token
CREATE POLICY "Users can insert their own push token"
  ON employee_push_tokens
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own push token"
  ON employee_push_tokens
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can select their own push tokens"
  ON employee_push_tokens
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- 6. Allow admins to read ALL tokens (for sending notifications)
CREATE POLICY "Admins can read all push tokens"
  ON employee_push_tokens
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM employees
      WHERE employees.user_id = auth.uid()
        AND employees.role IN ('admin', 'supervisor')
    )
  );

-- 7. Verify: check what's in the table now
SELECT 
  ept.user_id,
  ept.expo_push_token,
  ept.device_name,
  ept.updated_at,
  e.first_name,
  e.last_name
FROM employee_push_tokens ept
LEFT JOIN employees e ON e.user_id = ept.user_id
ORDER BY ept.updated_at DESC;
