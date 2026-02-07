-- Check the actual schema of bank_transactions table
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'bank_transactions'
ORDER BY ordinal_position;
