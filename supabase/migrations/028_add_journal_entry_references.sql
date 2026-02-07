-- Add reference tracking to journal entries
-- This allows us to link journal entries back to their source transactions

ALTER TABLE journal_entries
ADD COLUMN IF NOT EXISTS reference_type TEXT,
ADD COLUMN IF NOT EXISTS reference_id UUID;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_journal_entries_reference 
ON journal_entries(reference_type, reference_id);

-- Add comment
COMMENT ON COLUMN journal_entries.reference_type IS 'Type of source transaction: invoice, expense, bill, invoice_payment, bill_payment, manual';
COMMENT ON COLUMN journal_entries.reference_id IS 'ID of the source transaction record';
