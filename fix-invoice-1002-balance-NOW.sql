-- Fix Invoice #1002 balance - restore it to the full amount owed

-- Step 1: Check current state
SELECT 
    invoice_number,
    total,
    amount_paid,
    balance_due,
    payment_status
FROM invoices
WHERE invoice_number = '1002';

-- Step 2: Reset the payment and restore balance
UPDATE invoices
SET 
    payment_status = 'unpaid',
    amount_paid = 0,
    balance_due = total,  -- Restore balance to match total
    payment_date = NULL,
    payment_method = NULL,
    processing_fee = 0,
    net_deposit_amount = NULL
WHERE invoice_number = '1002';

-- Step 3: Verify it's fixed
SELECT 
    invoice_number,
    total,
    amount_paid,
    balance_due,
    payment_status,
    'FIXED - balance restored!' as status
FROM invoices
WHERE invoice_number = '1002';
