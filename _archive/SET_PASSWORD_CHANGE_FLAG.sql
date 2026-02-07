-- Set password_must_change flag to true for testing
-- Replace 'your_email@example.com' with the actual test employee email

UPDATE employees 
SET password_must_change = true 
WHERE email = 'your_email@example.com';

-- To check all employees and their password_must_change status:
SELECT email, password_must_change, first_name, last_name 
FROM employees 
ORDER BY email;
