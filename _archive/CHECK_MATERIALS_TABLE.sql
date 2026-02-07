-- Check if materials table exists and what data it contains

-- 1. Check if materials table exists
SELECT EXISTS (
   SELECT FROM information_schema.tables 
   WHERE table_schema = 'public'
   AND table_name = 'materials'
);

-- 2. If it exists, check the structure
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'materials';

-- 3. Check how many records are in materials table
SELECT COUNT(*) as total_materials FROM materials;

-- 4. Check unique categories in materials table
SELECT DISTINCT category, COUNT(*) as count
FROM materials
GROUP BY category
ORDER BY category;

-- 5. Check a few sample records
SELECT id, name, category, unit
FROM materials
LIMIT 10;

-- 6. Check custom_materials for comparison
SELECT DISTINCT category, COUNT(*) as count
FROM custom_materials
WHERE is_active = true
GROUP BY category
ORDER BY category;
