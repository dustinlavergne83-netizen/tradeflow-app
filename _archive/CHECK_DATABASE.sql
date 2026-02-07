-- Check what was actually saved to the database

-- For Change Orders:
SELECT 
  id,
  change_order_id,
  section,
  sequence,
  description,
  parent_id,
  created_at
FROM change_order_items
WHERE change_order_id = (SELECT id FROM change_orders ORDER BY created_at DESC LIMIT 1)
ORDER BY section, sequence;

-- For Regular Estimates:
SELECT 
  id,
  estimate_id,
  section,
  sequence,
  description,
  parent_id,
  created_at
FROM estimate_items
WHERE estimate_id = (SELECT id FROM estimates ORDER BY created_at DESC LIMIT 1)
ORDER BY section, sequence;

-- This will show you:
-- 1. What section the items were saved to
-- 2. If they have parent_id set
-- 3. The sequence order
-- 4. When they were created

-- If you see items here but they don't load, the problem is in loadSectionData()
-- If you don't see items here, the problem is in the save function
