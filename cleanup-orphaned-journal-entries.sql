-- Clean up orphaned journal entries for deleted invoices
-- This removes journal entry lines and journal entries where the referenced invoice no longer exists

-- First, delete journal entry lines for orphaned entries
DELETE FROM journal_entry_lines
WHERE entry_id IN (
  SELECT je.id 
  FROM journal_entries je
  WHERE je.reference_type = 'invoice' 
    AND je.reference_id NOT IN (SELECT id FROM invoices)
);

-- Then delete the orphaned journal entries themselves
DELETE FROM journal_entries
WHERE reference_type = 'invoice' 
  AND reference_id NOT IN (SELECT id FROM invoices);

-- Also clean up invoice_payment entries for deleted invoices
DELETE FROM journal_entry_lines
WHERE entry_id IN (
  SELECT je.id 
  FROM journal_entries je
  WHERE je.reference_type = 'invoice_payment' 
    AND je.reference_id NOT IN (SELECT id FROM invoices)
);

DELETE FROM journal_entries
WHERE reference_type = 'invoice_payment' 
  AND reference_id NOT IN (SELECT id FROM invoices);

-- Show what was deleted
SELECT 'Orphaned journal entries cleanup completed' as message;
