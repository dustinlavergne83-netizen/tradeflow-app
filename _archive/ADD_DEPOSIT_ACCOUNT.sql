-- Add deposit_account field to invoices
ALTER TABLE invoices
ADD COLUMN IF NOT EXISTS deposit_account TEXT;

-- Done! Run this in Supabase SQL Editor
