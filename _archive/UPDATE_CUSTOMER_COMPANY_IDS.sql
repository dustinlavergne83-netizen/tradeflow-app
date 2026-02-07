-- Update all customers to have your company_id
-- IMPORTANT: Keep the single quotes around the UUID!

-- First, find your user ID:
-- SELECT id, email FROM auth.users WHERE email = 'your@email.com';

-- Then run this update (replace YOUR_USER_ID_HERE but KEEP the quotes):
UPDATE customers 
SET company_id = 'YOUR_USER_ID_HERE'
WHERE company_id IS NULL;

-- Example (notice the quotes around the UUID):
-- UPDATE customers 
-- SET company_id = '3c75eb59-0549-46cb-b8d2-3a006a7a6c9a'
-- WHERE company_id IS NULL;

-- Verify the update:
SELECT COUNT(*) as total_customers, 
       COUNT(company_id) as customers_with_company_id
FROM customers;
