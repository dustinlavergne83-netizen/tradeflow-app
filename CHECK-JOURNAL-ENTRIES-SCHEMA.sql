-- Check actual journal_entries schema
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'journal_entries'
ORDER BY ordinal_position;
