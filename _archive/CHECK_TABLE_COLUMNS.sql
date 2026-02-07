-- Run this to see EXACTLY what columns your table has
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'base_materials' 
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- If you see baseCost and laborHours in the results above, then:
-- 1. Refresh your browser (Ctrl+F5)
-- 2. Try the CSV import again
-- 3. Make sure you're mapping: baseCost -> baseCost and laborHours -> laborHours

-- If you DON'T see baseCost and laborHours, copy the results and share them with me.
