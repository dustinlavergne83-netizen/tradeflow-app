-- Get the exact column names and types in assembly_components table
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'assembly_components'
ORDER BY ordinal_position;
