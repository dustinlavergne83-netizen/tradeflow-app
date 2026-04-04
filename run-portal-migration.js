// Run customer portal migration directly against Supabase DB
// Usage: node run-portal-migration.js

const { Client } = require('pg');

const sql = `
-- Customer Portal Setup
ALTER TABLE customers ADD COLUMN IF NOT EXISTS email text;

CREATE INDEX IF NOT EXISTS idx_customers_email_lower 
  ON customers (lower(email));

ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Customers can read own record" ON customers;
CREATE POLICY "Customers can read own record"
  ON customers FOR SELECT
  USING (lower(email) = lower(auth.jwt() ->> 'email'));

DROP POLICY IF EXISTS "Employees can read all customers" ON customers;
CREATE POLICY "Employees can read all customers"
  ON customers FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM employees
      WHERE lower(employees.email) = lower(auth.jwt() ->> 'email')
    )
  );

DROP POLICY IF EXISTS "Employees can manage customers" ON customers;
CREATE POLICY "Employees can manage customers"
  ON customers FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM employees
      WHERE lower(employees.email) = lower(auth.jwt() ->> 'email')
    )
  );

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
`;

async function main() {
  const client = new Client({
    host: 'aws-1-us-east-2.pooler.supabase.com',
    port: 5432,
    database: 'postgres',
    user: 'postgres.hyhjxdgdetdqoyoscflu',
    password: 'Ewjmrb12345!?',
    ssl: { rejectUnauthorized: false },
  });

  try {
    console.log('Connecting to Supabase database...');
    await client.connect();
    console.log('Connected! Running customer portal migration...');
    await client.query(sql);
    console.log('✅ Migration applied successfully!');
    console.log('');
    console.log('What was set up:');
    console.log('  ✓ customers.email column added');
    console.log('  ✓ RLS enabled on customers table');
    console.log('  ✓ Customers can view own invoices, estimates & projects');
    console.log('  ✓ Employees can manage all customers');
    console.log('');
    console.log('Next: Add email addresses to existing customers in Supabase');
    console.log('  UPDATE customers SET email = \'john@example.com\' WHERE name = \'John Smith\';');
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
