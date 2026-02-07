-- =============================================
-- CHECK INVOICE SCHEMA
-- =============================================
-- Run this FIRST to see what columns and tables exist

-- Step 1: Check what columns are in the invoices table
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'invoices'
ORDER BY ordinal_position;

-- Step 2: Check if invoice_payments table exists
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name LIKE '%payment%'
ORDER BY table_name;

-- Step 3: Check invoice #1002 data directly
SELECT *
FROM invoices
WHERE invoice_number = '1002';
