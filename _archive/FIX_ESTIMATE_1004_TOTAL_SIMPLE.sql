-- Simple fix: Set estimate 1004 total to the correct value
-- Based on your estimate summary showing $1157.00

UPDATE estimates
SET 
    total = 1157.00,
    subtotal = 1552.20
WHERE estimate_number = '1004';

-- Verify the fix
SELECT 
    estimate_number,
    subtotal,
    total,
    created_at
FROM estimates
WHERE estimate_number = '1004';
