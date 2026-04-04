-- ============================================================
-- DML Electrical Service — Customer Portal Setup
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. Add email column to customers table if it doesn't exist
ALTER TABLE customers ADD COLUMN IF NOT EXISTS email text;

-- 2. Add index for fast email lookups (case-insensitive)
CREATE INDEX IF NOT EXISTS idx_customers_email_lower 
  ON customers (lower(email));

-- 3. Enable RLS on customers table (if not already)
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

-- 4. Allow customers to read their own record
--    (matched by email from auth.users)
DROP POLICY IF EXISTS "Customers can read own record" ON customers;
CREATE POLICY "Customers can read own record"
  ON customers FOR SELECT
  USING (
    lower(email) = lower(auth.jwt() ->> 'email')
  );

-- 5. Allow employees/admins to read all customers
DROP POLICY IF EXISTS "Employees can read all customers" ON customers;
CREATE POLICY "Employees can read all customers"
  ON customers FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM employees
      WHERE lower(employees.email) = lower(auth.jwt() ->> 'email')
    )
  );

-- 6. Allow employees/admins to insert/update customers
DROP POLICY IF EXISTS "Employees can manage customers" ON customers;
CREATE POLICY "Employees can manage customers"
  ON customers FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM employees
      WHERE lower(employees.email) = lower(auth.jwt() ->> 'email')
    )
  );

-- ============================================================
-- OPTIONAL: Add email to existing customers
-- If you already have customers without emails, you can update them:
--
-- UPDATE customers SET email = 'customer@example.com' WHERE name = 'Customer Name';
--
-- ============================================================

-- 7. Allow customers to view their own invoices
--    (invoices where customer_name matches their name in customers table)
DROP POLICY IF EXISTS "Customers can view own invoices" ON invoices;
CREATE POLICY "Customers can view own invoices"
  ON invoices FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM customers
      WHERE lower(customers.email) = lower(auth.jwt() ->> 'email')
        AND lower(invoices.customer_name) = lower(customers.name)
    )
  );

-- 8. Allow customers to view their own proposals
DROP POLICY IF EXISTS "Customers can view own proposals" ON proposals;
CREATE POLICY "Customers can view own proposals"
  ON proposals FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM customers
      WHERE lower(customers.email) = lower(auth.jwt() ->> 'email')
        AND lower(proposals.customer_name) = lower(customers.name)
    )
  );

-- 9. Allow customers to view their own projects
DROP POLICY IF EXISTS "Customers can view own projects" ON projects;
CREATE POLICY "Customers can view own projects"
  ON projects FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM customers
      WHERE lower(customers.email) = lower(auth.jwt() ->> 'email')
        AND (
          lower(projects.customer) = lower(customers.name)
          OR lower(projects.contractor) = lower(customers.name)
        )
    )
  );

-- ============================================================
-- HOW TO ADD A CUSTOMER TO THE PORTAL:
-- ============================================================
-- 
-- Step 1: Make sure the customer has an email in the customers table:
--   UPDATE customers SET email = 'john@example.com' WHERE name = 'John Smith';
--
-- Step 2: Tell the customer to go to:
--   https://yourapp.com/customer/login
--
-- Step 3: Customer clicks "Create Account" and signs up with the 
--   same email you have on file.
--
-- Step 4: After email confirmation, they can log in and see their
--   invoices, estimates, and project status.
--
-- ============================================================
-- ROUTE SUMMARY:
-- ============================================================
-- /welcome              → DML Electrical Service website (public)
-- /customer/login       → Customer portal login/signup
-- /customer/portal      → Customer dashboard
-- /customer/invoices    → Customer invoices + Pay Now
-- /customer/estimates   → Customer estimates & proposals
-- /employee/portal      → Employee self-service portal
-- /signin               → Employee/Admin login (unchanged)
-- /                     → Admin/Employee app dashboard (unchanged)
-- ============================================================
