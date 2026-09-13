-- ══════════════════════════════════════════════════════════════
--  FEATURE FLAGS — seed companies.settings with per-company toggles
--  Run this in the Supabase Dashboard → SQL Editor
-- ══════════════════════════════════════════════════════════════
--
-- companies.settings is a JSONB column that already existed
-- (see MULTI_COMPANY_SETUP.sql) but was never actually populated
-- with feature toggles. This seeds sane defaults for the two
-- companies that exist today (DML, DT Specialties) without
-- touching any other settings already stored in that column.
--
-- Convention: every flag defaults to true/ON when absent, so a
-- missing key never silently disables something for a company
-- that hasn't been configured yet. See:
--   comms-mobile/lib/useBrand.ts        -> useFeatures()
--   timeclock-mobile/lib/useTheme.ts    -> isFullAccess pattern
--   src/lib/useFeatures.js              -> web equivalent
--
-- ──────────────────────────────────────────────────────────────
-- Step 1: DML — keep everything ON (matches current behavior)
-- ──────────────────────────────────────────────────────────────
UPDATE companies
SET settings = settings || '{
  "tier": "full",
  "aiAssistant": true,
  "dialpad": true,
  "email": true
}'::jsonb
WHERE slug = 'dml-electrical';

-- ──────────────────────────────────────────────────────────────
-- Step 2: DT Specialties — example: no AI assistant tab yet
-- (edit the values below to whatever DT actually needs first)
-- ──────────────────────────────────────────────────────────────
UPDATE companies
SET settings = settings || '{
  "tier": "basic",
  "aiAssistant": false,
  "dialpad": true,
  "email": true
}'::jsonb
WHERE slug = 'dt-specialties';

-- ──────────────────────────────────────────────────────────────
-- Step 3: Verify
-- ──────────────────────────────────────────────────────────────
SELECT name, slug, settings
FROM companies
WHERE slug IN ('dml-electrical', 'dt-specialties');
