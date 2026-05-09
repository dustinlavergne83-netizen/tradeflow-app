-- ============================================================
-- SET DML COMPANY LOGO URL
-- 
-- STEP 1: Upload your logo to Supabase Storage
--   1. Go to Supabase Dashboard → Storage
--   2. Create a bucket called "company-logos" (set to Public)
--   3. Upload LOGOD.jpg (found in timeclock-mobile/assets/LOGOD.jpg)
--   4. Click the uploaded file → Copy URL
--   5. Paste that URL in the UPDATE below
--
-- STEP 2: Run this SQL in Supabase SQL Editor
-- ============================================================

UPDATE companies
SET logo_url = 'PASTE_YOUR_SUPABASE_STORAGE_URL_HERE'
WHERE name ILIKE '%DML%'
   OR name ILIKE '%Lavergne%';

-- Verify it was set:
SELECT id, name, logo_url FROM companies;
