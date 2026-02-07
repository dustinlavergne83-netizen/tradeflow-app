-- Diagnose journal entry creation issue
-- Check if journal entry lines are being created with valid account IDs

SELECT 
  'JOURNAL ENTRIES WITH LINES' as section,
  je.id,
  je.entry_number,
  je.entry_date,
  je.description,
  je.reference_type,
  je.reference_id,
  je.is_posted,
  je.posted,
  COUNT(jel.id) as line_count,
  STRING_AGG(
    COALESCE(a.account_number || ' - ' || a.account_name || ' (Debit: ' || jel.debit || ', Credit: ' || jel.credit || ')', 'ACCOUNT NOT FOUND! Account ID: ' || jel.account_id),
    ' | '
  ) as line_details
FROM journal_entries je
LEFT JOIN journal_entry_lines jel ON je.id = jel.entry_id
LEFT JOIN accounts a ON jel.account_id = a.id
WHERE je.reference_type = 'bank_transaction'
GROUP BY je.id, je.entry_number, je.entry_date, je.description, je.reference_type, je.reference_id, je.is_posted, je.posted
ORDER BY je.entry_date DESC
LIMIT 10;

-- Check for orphaned journal entry lines (lines with invalid account IDs)
SELECT 
  'ORPHANED JOURNAL ENTRY LINES' as section,
  jel.id,
  jel.entry_id,
  jel.account_id,
  jel.debit,
  jel.credit,
  je.description
FROM journal_entry_lines jel
LEFT JOIN journal_entries je ON jel.entry_id = je.id
LEFT JOIN accounts a ON jel.account_id = a.id
WHERE jel.account_id IS NULL OR a.id IS NULL
LIMIT 20;

-- Check all accounts to make sure they exist
SELECT 
  'AVAILABLE ACCOUNTS' as section,
  id,
  account_number,
  account_name,
  account_type
FROM accounts
WHERE company_id = 'user-id-here'
ORDER BY account_number
LIMIT 20;
