-- Direct SQL update to fix estimate #1005 total
-- This bypasses RLS policies

UPDATE estimates 
SET total = 6600.30
WHERE estimate_number = '1005';

-- Verify the update
SELECT 
  estimate_number, 
  total,
  project_name
FROM estimates 
WHERE estimate_number = '1005';
