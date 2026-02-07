-- Query to list ALL columns in assembly_components table with their details

SELECT 
    column_name,
    data_type,
    character_maximum_length,
    is_nullable,
    column_default
FROM 
    information_schema.columns
WHERE 
    table_schema = 'public' 
    AND table_name = 'assembly_components'
ORDER BY 
    ordinal_position;

-- Alternative simpler query (just column names):
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'assembly_components' ORDER BY ordinal_position;
