-- Check what was actually saved after export

-- Show ALL estimate items (most recent first)
SELECT 
  estimate_id,
  section,
  sequence,
  description,
  quantity,
  parent_id,
  created_at
FROM estimate_items
ORDER BY created_at DESC
LIMIT 50;

-- Count items by section
SELECT 
  section,
  COUNT(*) as item_count
FROM estimate_items
GROUP BY section
ORDER BY section;

-- Show the most recent estimate ID
SELECT 
  id as estimate_id,
  project_name,
  estimate_number,
  created_at
FROM estimates
ORDER BY created_at DESC
LIMIT 5;
