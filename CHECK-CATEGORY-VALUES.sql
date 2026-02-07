-- Check what category values are being stored for cleared transactions
SELECT 
  id,
  description,
  amount,
  category,
  is_cleared,
  transaction_date
FROM bank_transactions
WHERE is_cleared = true
  AND linked_invoice_id IS NULL
  AND linked_expense_id IS NULL
ORDER BY transaction_date DESC
LIMIT 5;

-- Check if category is a valid account ID or a name/string
SELECT DISTINCT
  bt.category,
  a.id,
  a.account_number,
  a.account_name
FROM bank_transactions bt
LEFT JOIN accounts a ON bt.category = a.id
WHERE bt.category IS NOT NULL
  AND bt.linked_invoice_id IS NULL
  AND bt.linked_expense_id IS NULL
LIMIT 10;
