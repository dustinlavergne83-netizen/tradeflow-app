-- ============================================================
-- TradeFlow: Add invite_token column to employees table
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. Add invite_token column to employees table
ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS invite_token TEXT DEFAULT NULL;

-- 2. Create an index on invite_token for fast lookups
CREATE INDEX IF NOT EXISTS idx_employees_invite_token
  ON employees(invite_token)
  WHERE invite_token IS NOT NULL;

-- 3. Verify the column was added
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'employees'
  AND column_name = 'invite_token';

-- ============================================================
-- How the invite flow works:
-- 
-- 1. Admin visits /:slug/dashboard → Employees tab → "Invite Employee"
-- 2. Admin fills in name, email, phone, role → clicks "Generate Invite Link"
-- 3. System creates an employees record with invite_token = UUID, user_id = NULL
-- 4. Admin copies the invite link: https://app.../SLUG/clock?invite=TOKEN
-- 5. Admin texts or emails the link to the employee
-- 6. Employee visits the link → sees "Welcome, [Name]! Create your account"
-- 7. Employee enters a password → Supabase auth.signUp creates their account
-- 8. System updates employees SET user_id = new_uid, invite_token = NULL
-- 9. Employee is now active and can clock in
-- ============================================================
