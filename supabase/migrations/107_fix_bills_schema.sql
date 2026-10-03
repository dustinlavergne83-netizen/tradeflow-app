-- Fixes the Bills feature, which was writing to columns that don't exist on
-- the `bills` table (amount, description, category, payment_status, paid_date)
-- causing every "Add Bill" save to fail with
-- "Could not find the 'amount' column of 'bills' in the schema cache".
--
-- The `bills` table had 0 rows at the time of this migration, so this is a
-- pure schema fix with no data migration needed.

-- Link a bill to the vendor record (for autocomplete / lookups)
ALTER TABLE bills ADD COLUMN IF NOT EXISTS vendor_id UUID REFERENCES vendors(id) ON DELETE SET NULL;

-- Which liability account this bill is owed on (a vendor-specific charge
-- account like "2130 Teche Electric Account" when the vendor has one,
-- otherwise generic "2000 Accounts Payable")
ALTER TABLE bills ADD COLUMN IF NOT EXISTS liability_account_id UUID REFERENCES accounts(id);

-- Free-text description field (the UI already has a Description input but
-- the table never had a column for it)
ALTER TABLE bills ADD COLUMN IF NOT EXISTS description TEXT;

-- When the bill was actually paid, and which bank account paid it
ALTER TABLE bills ADD COLUMN IF NOT EXISTS paid_date DATE;
ALTER TABLE bills ADD COLUMN IF NOT EXISTS payment_bank_account_id UUID REFERENCES accounts(id);

-- bill_number and due_date are optional in the UI but were NOT NULL in the
-- table, which would also have blocked saves once the column-name bugs were
-- fixed. Relax both to nullable.
ALTER TABLE bills ALTER COLUMN bill_number DROP NOT NULL;
ALTER TABLE bills ALTER COLUMN due_date DROP NOT NULL;

COMMENT ON COLUMN bills.vendor_id IS 'Vendor this bill is from (links to vendors table for autocomplete)';
COMMENT ON COLUMN bills.liability_account_id IS 'Chart of Accounts liability account this bill is credited to: the vendor''s charge account if one exists (via accounts.vendor_id), otherwise generic Accounts Payable';
COMMENT ON COLUMN bills.payment_bank_account_id IS 'Bank/cash account the bill was paid from, set when marked as paid';
