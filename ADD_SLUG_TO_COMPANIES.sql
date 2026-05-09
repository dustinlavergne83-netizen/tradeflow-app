-- Add slug column to companies table
-- Slug is the URL-friendly identifier: e.g. "dml" → tradeflow.com/dml

ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS slug TEXT UNIQUE;

-- Set DML Electric's slug (run after adding the column)
-- Find your company ID first with: SELECT id, name FROM companies;
-- Then update:
UPDATE companies
  SET slug = 'dml'
  WHERE LOWER(name) LIKE '%dml%';

-- For other companies, run:
-- UPDATE companies SET slug = 'smithplumbing' WHERE id = 'YOUR-COMPANY-ID';

-- Verify
SELECT id, name, slug FROM companies ORDER BY name;
