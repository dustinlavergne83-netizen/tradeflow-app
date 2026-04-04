-- ============================================================
-- DML Electrical Service — Customer Portal Setup (FIXED)
-- This version handles the case where proposals uses different column names
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

-- 6. Allow employees/admins to manage customers
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
-- INVOICES: Allow customers to view their own
-- ============================================================
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

-- ============================================================
-- PROPOSALS: Check which column stores the customer name
-- Run this query first to see the actual column names:
--   SELECT column_name FROM information_schema.columns 
--   WHERE table_name = 'proposals' ORDER BY ordinal_position;
--
-- Then uncomment the correct policy below:
-- ============================================================

-- OPTION A: If proposals uses "customer_name"
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

-- OPTION B: If proposals uses "client_name"
-- DROP POLICY IF EXISTS "Customers can view own proposals" ON proposals;
-- CREATE POLICY "Customers can view own proposals"
--   ON proposals FOR SELECT
--   USING (
--     EXISTS (
--       SELECT 1 FROM customers
--       WHERE lower(customers.email) = lower(auth.jwt() ->> 'email')
--         AND lower(proposals.client_name) = lower(customers.name)
--     )
--   );

-- OPTION C: If proposals links via a customer_id foreign key
 DROP POLICY IF EXISTS "Customers can view own proposals" ON proposals;
 CREATE POLICY "Customers can view own proposals"
  ON proposals FOR SELECT
  USING (
     EXISTS (
       SELECT 1 FROM customers
       WHERE lower(customers.email) = lower(auth.jwt() ->> 'email')
        AND proposals.customer_id = customers.id
     )
   );

-- ============================================================
-- PROJECTS: Allow customers to view their own
-- ============================================================
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
-- RUN THIS FIRST to find the actual proposals column name:
-- ============================================================
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'proposals' 
ORDER BY ordinal_position;

-- ============================================================
-- HOW TO ADD A CUSTOMER TO THE PORTAL:
-- ============================================================
-- Step 1: Add/confirm email in the customers table:
--   UPDATE customers SET email = 'john@example.com' WHERE name = 'John Smith';
--
-- Step 2: Tell the customer to sign up at /customer/login
--   with that same email address.
--
-- Step 3: They can now see their invoices, estimates & project status.
-- ============================================================
