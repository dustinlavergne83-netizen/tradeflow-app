-- Check actual journal_entry_lines schema
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'journal_entry_lines'
ORDER BY ordinal_position;
