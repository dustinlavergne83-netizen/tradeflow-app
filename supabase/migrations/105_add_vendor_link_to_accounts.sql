-- ============================================================================
-- Link Chart of Accounts (Liability) entries to their Vendor record
-- ============================================================================
-- Problem: supplier charge/open accounts (e.g. "2130 Teche Electric Account")
-- have no relationship to the corresponding Vendor record (e.g. "Teche
-- Electric Supply"), so selecting a Charge Account in the Expenses modal
-- can't auto-populate the Vendor field — the user has to pick both
-- separately even though they always go together.
--
-- Fix: add accounts.vendor_id so a liability account can point at the
-- vendor it represents. Populate the known supplier charge accounts.
-- ============================================================================

ALTER TABLE accounts ADD COLUMN IF NOT EXISTS vendor_id UUID REFERENCES vendors(id) ON DELETE SET NULL;

COMMENT ON COLUMN accounts.vendor_id IS 'For Liability-type charge/open accounts (e.g. a supplier account), the Vendor record this account represents. Used to auto-populate the Vendor field when this account is selected as a Charge Account payment method on an expense.';

-- Populate known supplier charge account <-> vendor pairs
UPDATE accounts a SET vendor_id = v.id
FROM vendors v
WHERE a.account_number = '2110' AND v.vendor_name = 'Lowe''s' AND v.company_id = a.company_id;

UPDATE accounts a SET vendor_id = v.id
FROM vendors v
WHERE a.account_number = '2120' AND v.vendor_name = 'Elliott Electric Supply' AND v.company_id = a.company_id;

UPDATE accounts a SET vendor_id = v.id
FROM vendors v
WHERE a.account_number = '2130' AND v.vendor_name = 'Teche Electric Supply' AND v.company_id = a.company_id;

UPDATE accounts a SET vendor_id = v.id
FROM vendors v
WHERE a.account_number = '2140' AND v.vendor_name = 'Coburns Electric Supply' AND v.company_id = a.company_id;
