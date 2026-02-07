-- =============================================
-- DELETE INVOICE_PAYMENT JOURNAL ENTRIES
-- =============================================
-- The CASH transaction might be linked to an invoice
-- The duplicate check also looks for reference_type='invoice_payment'

-- Step 1: Check if CASH transaction is linked to an invoice
SELECT 
    bt.id as transaction_id,
    bt.description,
    bt.amount,
    bt.linked_invoice_id,
    i.invoice_number,
    i.customer_name,
    i.total
FROM bank_transactions bt
LEFT JOIN invoices i ON bt.linked_invoice_id = i.id
WHERE bt.amount = 165.92
  AND bt.description LIKE '%CASH%'
  AND bt.bank_account_id = (SELECT id FROM bank_accounts WHERE account_name = 'Main Checking');

-- Step 2: Find journal entries with reference_type='invoice_payment' for that invoice
SELECT 
    je.id,
    je.entry_number,
    je.entry_date,
    je.description,
    je.is_posted,
    je.reference_type,
    je.reference_id,
    i.invoice_number
FROM journal_entries je
JOIN invoices i ON je.reference_id = i.id
WHERE je.reference_type = 'invoice_payment'
  AND i.id IN (
      SELECT linked_invoice_id 
      FROM bank_transactions 
      WHERE amount = 165.92
        AND description LIKE '%CASH%'
        AND bank_account_id = (SELECT id FROM bank_accounts WHERE account_name = 'Main Checking')
        AND linked_invoice_id IS NOT NULL
  );

-- Step 3: DELETE invoice_payment journal entries (uncomment to run)
/*
DELETE FROM journal_entries
WHERE reference_type = 'invoice_payment'
  AND reference_id IN (
      SELECT linked_invoice_id 
      FROM bank_transactions 
      WHERE amount = 165.92
        AND description LIKE '%CASH%'
        AND bank_account_id = (SELECT id FROM bank_accounts WHERE account_name = 'Main Checking')
        AND linked_invoice_id IS NOT NULL
  )
RETURNING entry_number, description;
*/
