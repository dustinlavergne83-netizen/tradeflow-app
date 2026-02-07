-- Check estimate items for the Fresh Water Bayou estimate (most recent one)
-- Estimate ID: ab51e03f-06ce-46b9-8543-04921f6725a4

SELECT 
  id,
  estimate_id,
  section,
  sequence,
  description,
  quantity,
  unit,
  parent_id,
  created_at
FROM estimate_items
WHERE estimate_id = 'ab51e03f-06ce-46b9-8543-04921f6725a4'
ORDER BY section, sequence;

-- If no rows, check ALL estimate_items
SELECT 
  estimate_id,
  section,
  COUNT(*) as count
FROM estimate_items
GROUP BY estimate_id, section
ORDER BY estimate_id;
