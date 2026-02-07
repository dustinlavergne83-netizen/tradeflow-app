-- Disable any automatic journal entry creation on invoices
-- Journal entries should ONLY be created when an invoice is SENT, not when it's created/updated

-- Check if there's a trigger that auto-creates journal entries on invoice insert
DROP TRIGGER IF EXISTS auto_create_invoice_journal_entry ON invoices;
DROP FUNCTION IF EXISTS create_invoice_journal_entry_on_insert();

-- Ensure no other triggers are auto-creating entries
DROP TRIGGER IF EXISTS trigger_create_journal_entry_on_invoice ON invoices;
DROP FUNCTION IF EXISTS trigger_function_create_journal_entry_on_invoice();

-- Add a comment documenting the policy
COMMENT ON TABLE invoices IS 'Journal entries are created ONLY when invoices are SENT (status=sent), not on creation or updates. This prevents duplicate AR entries.';
