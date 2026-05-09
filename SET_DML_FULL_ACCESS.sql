-- ============================================================
-- SET DML COMPANY TO FULL ACCESS (tier: 'full')
-- This unlocks Projects, Estimates, Invoices, Check Stubs,
-- and Scan Receipt tiles in the admin dashboard.
--
-- Run this in Supabase SQL Editor ONCE.
-- ============================================================

-- Auto-detect your DML company by name and set tier = 'full'
UPDATE companies
SET settings = COALESCE(settings, '{}'::jsonb) || '{"tier": "full"}'::jsonb
WHERE name ILIKE '%DML%' OR name ILIKE '%Lavergne%';

-- Verify
SELECT id, name, settings FROM companies ORDER BY created_at;

-- NOTE: New companies created via the Create Company flow will
-- default to tier: 'basic' (no settings.tier set), so they
-- automatically get the simplified 4-tile admin dashboard.
-- To upgrade any company to full access, run:
--   UPDATE companies SET settings = settings || '{"tier": "full"}' WHERE id = '<company_uuid>';
