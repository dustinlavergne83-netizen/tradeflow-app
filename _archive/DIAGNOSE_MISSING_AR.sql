-- Check if invoice exists but journal entry is missing

-- 1. Check recent invoices and their status
SELECT 
    id,
    invoice_number,
    customer_name,
    invoice_date,
    total,
    status,
    created_at
FROM invoices
ORDER BY created_at DESC
LIMIT 10;

-- 2. Check if journal entries exist for those invoices
SELECT 
    i.invoice_number,
    i.total,
    i.status,
    je.id as journal_entry_id,
    je.entry_number,
    je.is_posted
FROM invoices i
LEFT JOIN journal_entries je ON je.reference_type = 'invoice' AND je.reference_id = i.id
ORDER BY i.created_at DESC
LIMIT 10;

-- 3. Check Accounts Receivable balance
SELECT 
    a.account_number,
    a.account_name,
    SUM(jel.debit - jel.credit) as balance
FROM accounts a
LEFT JOIN journal_entry_lines jel ON jel.account_id = a.id
LEFT JOIN journal_entries je ON je.id = jel.entry_id AND je.is_posted = true
WHERE a.account_name ILIKE '%receivable%'
GROUP BY a.id, a.account_number, a.account_name;

-- 4. List all journal entry lines for A/R account
SELECT 
    je.entry_date,
    je.entry_number,
    je.description,
    jel.debit,
    jel.credit,
    je.reference_type,
    je.reference_id
FROM accounts a
JOIN journal_entry_lines jel ON jel.account_id = a.id
JOIN journal_entries je ON je.id = jel.entry_id
WHERE a.account_name ILIKE '%receivable%'
  AND je.is_posted = true
ORDER BY je.entry_date DESC;
