-- =============================================
-- RESET INVOICE #1002 TO UNPAID - UNDO PAYMENT
-- =============================================
-- Resets invoice back to unpaid status with full $240 balance

-- Step 1: Check current state
SELECT 
    invoice_number,
    total,
    amount_paid,
    balance_due,
    payment_status,
    payment_date
FROM invoices
WHERE invoice_number = '1002';

-- Step 2: Reset invoice #1002 - Clear payment, restore full balance (uncomment to run)
/*
UPDATE invoices
SET 
    amount_paid = 0,
    balance_due = total,
    payment_status = 'unpaid',
    payment_date = NULL,
    payment_method = NULL,
    payment_notes = NULL,
    updated_at = NOW()
WHERE invoice_number = '1002'
RETURNING invoice_number, total, amount_paid, balance_due, payment_status;
*/

-- Step 3: Verify the reset worked
/*
SELECT 
    invoice_number,
    total,
    amount_paid,
    balance_due,
    payment_status,
    payment_date
FROM invoices
WHERE invoice_number = '1002';
*/
