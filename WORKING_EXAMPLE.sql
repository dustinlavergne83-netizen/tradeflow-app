-- ========================================
-- WORKING EXAMPLE: Link 1/2" EMT Compression Fittings
-- ========================================

-- STEP 1: Find the compression coupling ID
-- Copy the "id" value from the results
SELECT id, name 
FROM base_materials 
WHERE name ILIKE '%1/2" emt%compression%coupling%'
  AND name NOT ILIKE '%1-1/2%'
LIMIT 1;

-- Let's say the ID you copied is: abc-123-xyz-456
-- (Your actual ID will be different - it's a long string)

-- STEP 2: Use that ID in the UPDATE statement
-- Replace 'abc-123-xyz-456' with YOUR actual ID from Step 1
UPDATE base_materials 
SET auto_add_coupling_id = 'abc-123-xyz-456'  -- ← Put the ID HERE in quotes
WHERE name ILIKE '%1/2" emt%'
  AND name NOT ILIKE '%1-1/2%'
  AND name ILIKE '%compression%'
  AND (name ILIKE '%90%' OR name ILIKE '%45%');

-- STEP 3: Verify it worked
SELECT 
  f.name AS fitting,
  c.name AS coupling_linked
FROM base_materials f
JOIN base_materials c ON f.auto_add_coupling_id = c.id
WHERE f.name ILIKE '%1/2" emt%compression%'
  AND (f.name ILIKE '%90%' OR f.name ILIKE '%45%');

-- ========================================
-- KEY POINT: 
-- The UPDATE statement needs the ACTUAL ID STRING (in quotes)
-- NOT a variable name or column name
-- Example: '550e8400-e29b-41d4-a716-446655440000'
-- ========================================
