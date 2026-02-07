-- Remove Owner Draws from Expenses Table
-- This will delete any expenses with "owner draw", "owner withdrawal", or "owner distribution" in the description

-- First, let's see what will be deleted
SELECT 
  id,
  expense_date,
  vendor,
  amount,
  description,
  category
FROM expenses
WHERE 
  LOWER(description) LIKE '%owner draw%'
  OR LOWER(description) LIKE '%owner withdrawal%'
  OR LOWER(description) LIKE '%owner distribution%'
ORDER BY expense_date DESC;

-- Now delete them (uncomment the DELETE statement below to actually run it)
-- DELETE FROM expenses
-- WHERE 
--   LOWER(description) LIKE '%owner draw%'
--   OR LOWER(description) LIKE '%owner withdrawal%'
--   OR LOWER(description) LIKE '%owner distribution%';
