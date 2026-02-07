-- FRESH START: Delete ALL assemblies and components for your company
-- This gives us a clean slate to import the 10 EMT assemblies

-- Step 1: Delete all assembly components first
DELETE FROM assembly_components 
WHERE assembly_id IN (
  SELECT id FROM assemblies WHERE company_id = '3c75eb59-0549-46cb-b8d2-3a006a7a6c9a'
);

-- Step 2: Delete all assemblies
DELETE FROM assemblies 
WHERE company_id = '3c75eb59-0549-46cb-b8d2-3a006a7a6c9a';

-- Verify everything is gone
SELECT COUNT(*) as remaining_assemblies
FROM assemblies 
WHERE company_id = '3c75eb59-0549-46cb-b8d2-3a006a7a6c9a';

SELECT COUNT(*) as remaining_components
FROM assembly_components 
WHERE assembly_id IN (
  SELECT id FROM assemblies WHERE company_id = '3c75eb59-0549-46cb-b8d2-3a006a7a6c9a'
);
