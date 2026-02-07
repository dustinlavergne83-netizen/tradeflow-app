-- Verify Lowes account 2110 debits and credits are correct

SELECT 
  a.account_number,
  a.account_name,
  a.account_type,
  a.normal_balance,
  SUM(CASE WHEN jel.debit > 0 THEN jel.debit ELSE 0 END) as total_debits,
  SUM(CASE WHEN jel.credit > 0 THEN jel.credit ELSE 0 END) as total_credits,
  SUM(CASE WHEN jel.debit > 0 THEN jel.debit ELSE 0 END) - SUM(CASE WHEN jel.credit > 0 THEN jel.credit ELSE 0 END) as calculated_balance
FROM accounts a
LEFT JOIN journal_entry_lines jel ON a.id = jel.account_id
WHERE a.account_number = '2110'
GROUP BY a.id, a.account_number, a.account_name, a.account_type, a.normal_balance;

-- Also show all journal entries for Lowes
SELECT 
  je.entry_number,
  je.entry_date,
  je.description,
  jel.line_number,
  jel.debit,
  jel.credit,
  CASE 
    WHEN a.account_type = 'Liability' AND a.normal_balance = 'credit' THEN
      CASE WHEN jel.credit > 0 THEN 'Increase liability ✓' WHEN jel.debit > 0 THEN 'Decrease liability ✓' END
    ELSE 'Check manually'
  END as interpretation
FROM journal_entries je
JOIN journal_entry_lines jel ON je.id = jel.entry_id
JOIN accounts a ON jel.account_id = a.id
WHERE a.account_number = '2110'
ORDER BY je.entry_date DESC, je.entry_number DESC, jel.line_number;
