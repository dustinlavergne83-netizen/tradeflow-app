-- ================================================================
-- FIX MISSING MATERIALS IN WEB APP - RLS Issue
-- ================================================================
-- Materials added directly to database aren't showing because they're
-- missing the user_id field required by Row Level Security (RLS)
-- ================================================================

-- STEP 1: Check which materials are missing user_id
SELECT 
  'Materials Missing user_id' as issue,
  COUNT(*) as count
FROM base_materials
WHERE user_id IS NULL;

-- STEP 2: Show the materials that won't appear in web app
SELECT 
  'Materials Without user_id (hidden from app)' as status,
  id,
  name,
  user_id
FROM base_materials
WHERE user_id IS NULL
ORDER BY id
LIMIT 20;

-- STEP 3: FIX IT - Set user_id for all materials
-- (You need to replace 'YOUR_USER_ID' with your actual user ID)
/*
BEGIN;

-- Get your user_id first:
-- SELECT id FROM auth.users WHERE email = 'your@email.com';

-- Then update all materials to have your user_id:
UPDATE base_materials 
SET user_id = 'YOUR_USER_ID_HERE'
WHERE user_id IS NULL;

COMMIT;
*/

-- STEP 4: Verify all materials now have user_id
SELECT 
  'Materials Status After Fix' as status,
  COUNT(CASE WHEN user_id IS NULL THEN 1 END) as missing_user_id,
  COUNT(CASE WHEN user_id IS NOT NULL THEN 1 END) as has_user_id,
  COUNT(*) as total
FROM base_materials;
