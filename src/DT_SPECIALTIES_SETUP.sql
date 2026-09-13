-- ══════════════════════════════════════════════════════════════
--  DT SPECIALTIES — Company Setup SQL
--  Run this in the Supabase Dashboard → SQL Editor
-- ══════════════════════════════════════════════════════════════

-- Step 1: Insert the DT Specialties company record
INSERT INTO companies (
  name,
  slug,
  primary_color,
  secondary_color,
  subscription_tier,
  subscription_status,
  created_at
)
VALUES (
  'DT Specialties',
  'dt-specialties',
  '#461D7C',   -- LSU Purple
  '#FDD023',   -- LSU Gold
  'basic',
  'active',
  NOW()
)
RETURNING id, name, slug, primary_color, secondary_color;

-- ⬆  Copy the returned `id` — you will need it for employees.

-- ══════════════════════════════════════════════════════════════
-- Step 2 (optional): Add logo_url column if it does not exist yet
-- ══════════════════════════════════════════════════════════════
ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS logo_url TEXT;

-- ══════════════════════════════════════════════════════════════
-- Step 3: Verify the insert
-- ══════════════════════════════════════════════════════════════
SELECT id, name, slug, primary_color, secondary_color, subscription_status
FROM companies
WHERE slug = 'dt-specialties';

-- ══════════════════════════════════════════════════════════════
-- Step 4: When ready to add your first admin user:
--   Option A) Use /super-admin page → "Onboard New Company" form
--             (already creates auth user + employee in one click)
--
--   Option B) After creating auth user manually in Supabase:
-- INSERT INTO employees (
--   user_id,       -- from Supabase Auth > Users
--   email,
--   first_name,
--   last_name,
--   role,
--   company_id,    -- id returned from Step 1 above
--   is_active
-- ) VALUES (
--   'AUTH-USER-UUID-HERE',
--   'admin@dtspecialties.com',
--   'First',
--   'Last',
--   'admin',
--   'COMPANY-UUID-FROM-STEP-1',
--   true
-- );
-- ══════════════════════════════════════════════════════════════
