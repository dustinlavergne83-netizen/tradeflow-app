-- Check if journal entries are being created for bank transactions
SELECT 
  je.id,
  je.entry_number,
  je.entry_date,
  je.description,
  je.reference_type,
  je.is_posted,
  COUNT(jel.id) as line_count
FROM journal_entries je
LEFT JOIN journal_entry_lines jel ON je.id = jel.entry_id
WHERE je.reference_type = 'bank_transaction'
GROUP BY je.id, je.entry_number, je.entry_date, je.description, je.reference_type, je.is_posted
ORDER BY je.entry_date DESC
LIMIT 20;

-- ============================================================================
-- If entries exist, check the lines:
-- ============================================================================
SELECT 
  je.entry_number,
  jel.line_number,
  a.account_number,
  a.account_name,
  jel.debit,
  jel.credit
FROM journal_entries je
JOIN journal_entry_lines jel ON je.id = jel.entry_id
JOIN accounts a ON jel.account_id = a.id
WHERE je.reference_type = 'bank_transaction'
ORDER BY je.entry_date DESC, jel.line_number
LIMIT 50;
