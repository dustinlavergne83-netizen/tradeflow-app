-- Reset all "applied" deposits that have no linked invoice back to "deposited"
UPDATE project_deposits 
SET status = 'deposited', 
    invoice_id = NULL, 
    applied_date = NULL 
WHERE status = 'applied';
