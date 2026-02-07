-- =============================================
-- FIX INVOICE #1002 PAYMENT STATUS
-- =============================================
-- Issue: Invoice shows UNPAID but has $0.00 balance
-- This happens when payments are recorded but status not updated

-- Step 1: Check invoice #1002 current state
SELECT 
    invoice_number,
    total,
    payment_status,
    payment_date,
    (SELECT COALESCE(SUM(amount_paid), 0) 
     FROM invoice_payments 
     WHERE invoice_id = invoices.id) as total_payments,
    (total - COALESCE((SELECT SUM(amount_paid) FROM invoice_payments WHERE invoice_id = invoices.id), 0)) as balance
FROM invoices
WHERE invoice_number = '1002';

-- Step 2: Check all payments for invoice #1002
SELECT 
    ip.payment_date,
    ip.amount_paid,
    ip.payment_method,
    ip.created_at
FROM invoice_payments ip
JOIN invoices i ON ip.invoice_id = i.id
WHERE i.invoice_number = '1002'
ORDER BY ip.payment_date;

-- Step 3: Fix invoice #1002 specifically (uncomment to run)
/*
UPDATE invoices
SET 
    payment_status = 'paid',
    payment_date = (
        SELECT MAX(payment_date) 
        FROM invoice_payments 
        WHERE invoice_id = invoices.id
    ),
    updated_at = NOW()
WHERE invoice_number = '1002'
  AND (total - COALESCE((SELECT SUM(amount_paid) FROM invoice_payments WHERE invoice_id = invoices.id), 0)) <= 0.01
  AND payment_status != 'paid'
RETURNING invoice_number, payment_status, payment_date, total;
*/

-- Step 4: Fix ALL invoices with this issue (uncomment to run)
/*
UPDATE invoices
SET 
    payment_status = 'paid',
    payment_date = (
        SELECT MAX(payment_date) 
        FROM invoice_payments 
        WHERE invoice_id = invoices.id
    ),
    updated_at = NOW()
WHERE id IN (
    SELECT i.id
    FROM invoices i
    WHERE (i.total - COALESCE((SELECT SUM(amount_paid) FROM invoice_payments WHERE invoice_id = i.id), 0)) <= 0.01
      AND i.payment_status != 'paid'
)
RETURNING invoice_number, payment_status, payment_date, total;
*/

-- Step 5: Verify the fix
/*
SELECT 
    invoice_number,
    total,
    payment_status,
    payment_date,
    (SELECT COALESCE(SUM(amount_paid), 0) 
     FROM invoice_payments 
     WHERE invoice_id = invoices.id) as total_payments,
    (total - COALESCE((SELECT SUM(amount_paid) FROM invoice_payments WHERE invoice_id = invoices.id), 0)) as balance
FROM invoices
WHERE invoice_number = '1002';
*/

-- Step 6: Find other invoices that might have same issue
SELECT 
    invoice_number,
    total,
    payment_status,
    (SELECT COALESCE(SUM(amount_paid), 0) 
     FROM invoice_payments 
     WHERE invoice_id = invoices.id) as total_payments,
    (total - COALESCE((SELECT SUM(amount_paid) FROM invoice_payments WHERE invoice_id = invoices.id), 0)) as balance
FROM invoices
WHERE (total - COALESCE((SELECT SUM(amount_paid) FROM invoice_payments WHERE invoice_id = invoices.id), 0)) <= 0.01
  AND payment_status != 'paid'
ORDER BY invoice_number;
