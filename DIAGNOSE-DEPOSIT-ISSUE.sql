-- DIAGNOSTIC: Find out exactly what's in the database for this invoice issue

-- 1. Find the invoice
SELECT id, invoice_number, total, amount_paid, deposit_received, status 
FROM invoices 
WHERE invoice_number LIKE '%1004-1%'
LIMIT 5;

-- 2. Find journal entries for this invoice
SELECT je.id, je.entry_number, je.description, je.is_posted, je.created_at
FROM journal_entries je
WHERE je.description ILIKE '%1004-1%' 
   OR je.reference_id IN (SELECT id FROM invoices WHERE invoice_number LIKE '%1004-1%')
ORDER BY je.created_at DESC;

-- 3. Find all journal entry lines for those entries
SELECT jel.id, jel.entry_id, a.account_name, a.account_number, jel.debit, jel.credit
FROM journal_entry_lines jel
JOIN accounts a ON jel.account_id = a.id
WHERE jel.entry_id IN (
  SELECT je.id FROM journal_entries je
  WHERE je.description ILIKE '%1004-1%' 
     OR je.reference_id IN (SELECT id FROM invoices WHERE invoice_number LIKE '%1004-1%')
)
ORDER BY jel.entry_id, jel.line_number;

-- 4. Check the current account balances
SELECT account_name, account_number, account_type, balance
FROM accounts
WHERE account_name IN ('Accounts Receivable', 'Customer Deposits', 'Previous Income')
   OR account_number IN ('1100', '1700', '4900');

-- 5. Manually sum what the balances SHOULD be from journal entries
SELECT a.account_name, a.account_number, a.account_type,
  SUM(CASE 
    WHEN a.account_type IN ('Asset', 'Expense', 'Drawing') THEN COALESCE(jel.debit, 0) - COALESCE(jel.credit, 0)
    WHEN a.account_type IN ('Liability', 'Equity', 'Revenue') THEN COALESCE(jel.credit, 0) - COALESCE(jel.debit, 0)
    ELSE 0
  END) as calculated_balance
FROM journal_entry_lines jel
JOIN journal_entries je ON jel.entry_id = je.id
JOIN accounts a ON jel.account_id = a.id
WHERE je.is_posted = true
  AND a.account_name IN ('Accounts Receivable', 'Customer Deposits', 'Previous Income')
GROUP BY a.account_name, a.account_number, a.account_type;
