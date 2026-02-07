-- Check if your update actually saved to database
-- Replace 'fish_tape_100' with the ID you're trying to update

SELECT 
    id, 
    name, 
    basecost, 
    laborhours,
    created_at,
    updated_at
FROM base_materials 
WHERE id = 'fish_tape_100';

-- Also check your employee role
SELECT id, email, role FROM employees WHERE id = auth.uid();
