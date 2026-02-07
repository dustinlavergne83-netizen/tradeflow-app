-- =============================================
-- FIX INVOICE #1002 BALANCE AFTER DELETING PAYMENT
-- =============================================
-- Issue: Payment was deleted but balance still shows $0.00
-- Should show full $240.00 owed

-- Step 1: Check current state of invoice #1002
SELECT 
    invoice_number,
    total,
    payment_status,
    payment_date,
    (SELECT COALESCE(SUM(amount_paid), 0) 
     FROM invoice_payments 
     WHERE invoice_id = invoices.id) as actual_payments,
    (total - COALESCE((SELECT SUM(amount_paid) FROM invoice_payments WHERE invoice_id = invoices.id), 0)) as calculated_balance
FROM invoices
WHERE invoice_number = '1002';

-- Step 2: Check if there are any invoice_payments for #1002
SELECT 
    payment_date,
    amount_paid,
    payment_method,
    created_at
FROM invoice_payments ip
JOIN invoices i ON ip.invoice_id = i.id
WHERE i.invoice_number = '1002'
ORDER BY ip.payment_date;

-- Step 3: Fix invoice #1002 - Reset to unpaid (uncomment to run)
/*
UPDATE invoices
SET 
    payment_status = 'unpaid',
    payment_date = NULL,
    updated_at = NOW()
WHERE invoice_number = '1002'
RETURNING invoice_number, total, payment_status;
*/

-- Step 4: Delete payment records for invoice #1002 (if needed - uncomment to run)
/*
DELETE FROM invoice_payments
WHERE invoice_id = (SELECT id FROM invoices WHERE invoice_number = '1002')
RETURNING payment_date, amount_paid;
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
     WHERE invoice_id = invoices.id) as total_payments
FROM invoices
WHERE invoice_number = '1002';
*/

-- Step 6: Fix ALL invoices - recalculate status based on actual payments (uncomment to run)
/*
UPDATE invoices
SET 
    payment_status = CASE 
        WHEN (total - COALESCE((SELECT SUM(amount_paid) FROM invoice_payments WHERE invoice_id = invoices.id), 0)) <= 0.01 THEN 'paid'
        WHEN (SELECT SUM(amount_paid) FROM invoice_payments WHERE invoice_id = invoices.id) > 0 THEN 'partial'
        ELSE 'unpaid'
    END,
    payment_date = CASE 
        WHEN (total - COALESCE((SELECT SUM(amount_paid) FROM invoice_payments WHERE invoice_id = invoices.id), 0)) <= 0.01 
        THEN (SELECT MAX(payment_date) FROM invoice_payments WHERE invoice_id = invoices.id)
        ELSE NULL
    END,
    updated_at = NOW()
WHERE payment_status != CASE 
    WHEN (total - COALESCE((SELECT SUM(amount_paid) FROM invoice_payments WHERE invoice_id = invoices.id), 0)) <= 0.01 THEN 'paid'
    WHEN (SELECT SUM(amount_paid) FROM invoice_payments WHERE invoice_id = invoices.id) > 0 THEN 'partial'
    ELSE 'unpaid'
END
RETURNING invoice_number, total, payment_status;
*/
