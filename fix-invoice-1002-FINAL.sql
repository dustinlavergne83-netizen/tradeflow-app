-- =============================================
-- FIX INVOICE #1002 PAYMENT STATUS - FINAL
-- =============================================
-- Based on actual schema - VERIFIED COLUMNS EXIST

-- Problem: amount_paid = 240, balance_due = 0, but payment_status = 'unpaid'
-- Solution: Update payment_status to match the actual payment data

-- Step 1: Verify current state
SELECT 
    invoice_number,
    total,
    amount_paid,
    balance_due,
    payment_status,
    payment_date
FROM invoices
WHERE invoice_number = '1002';

-- Step 2: Fix invoice #1002 - Set status to paid (uncomment to run)
/*
UPDATE invoices
SET 
    payment_status = 'paid',
    payment_date = COALESCE(payment_date, updated_at, NOW()),
    updated_at = NOW()
WHERE invoice_number = '1002'
  AND balance_due <= 0.01
RETURNING invoice_number, total, amount_paid, balance_due, payment_status, payment_date;
*/

-- Step 3: Fix ALL invoices with mismatched status (uncomment to run)
-- This finds invoices where balance is 0 but status is not 'paid'
/*
UPDATE invoices
SET 
    payment_status = 'paid',
    payment_date = COALESCE(payment_date, updated_at, NOW()),
    updated_at = NOW()
WHERE balance_due <= 0.01
  AND payment_status != 'paid'
RETURNING invoice_number, total, amount_paid, balance_due, payment_status;
*/

-- Step 4: Verify the fix worked
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
