-- Check what columns actually exist in the accounts table
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'accounts'
ORDER BY ordinal_position;
