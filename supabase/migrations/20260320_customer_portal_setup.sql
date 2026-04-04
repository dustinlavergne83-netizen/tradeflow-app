-- Customer Portal Setup
-- Adds email to customers table, sets up RLS for customer access

-- 1. Add email column to customers table
ALTER TABLE customers ADD COLUMN IF NOT EXISTS email text;

-- 2. Add index for fast email lookups
CREATE INDEX IF NOT EXISTS idx_customers_email_lower 
  ON customers (lower(email));

-- 3. Enable RLS on customers table
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

-- 4. Customers can read their own record
DROP POLICY IF EXISTS "Customers can read own record" ON customers;
CREATE POLICY "Customers can read own record"
  ON customers FOR SELECT
  USING (
    lower(email) = lower(auth.jwt() ->> 'email')
  );

-- 5. Employees can read all customers
DROP POLICY IF EXISTS "Employees can read all customers" ON customers;
CREATE POLICY "Employees can read all customers"
  ON customers FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM employees
      WHERE lower(employees.email) = lower(auth.jwt() ->> 'email')
    )
  );

-- 6. Employees can manage customers
DROP POLICY IF EXISTS "Employees can manage customers" ON customers;
CREATE POLICY "Employees can manage customers"
  ON customers FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM employees
      WHERE lower(employees.email) = lower(auth.jwt() ->> 'email')
    )
  );

-- 7. Customers can view their own invoices
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

-- 8. Customers can view their own estimates
DROP POLICY IF EXISTS "Customers can view own estimates" ON estimates;
CREATE POLICY "Customers can view own estimates"
  ON estimates FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM customers
      WHERE lower(customers.email) = lower(auth.jwt() ->> 'email')
        AND lower(estimates.customer_name) = lower(customers.name)
    )
  );

-- 9. Customers can view their own projects
DROP POLICY IF EXISTS "Customers can view own projects" ON projects;
CREATE POLICY "Customers can view own projects"
  ON projects FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM customers
      WHERE lower(customers.email) = lower(auth.jwt() ->> 'email')
        AND lower(projects.customer) = lower(customers.name)
    )
  );
