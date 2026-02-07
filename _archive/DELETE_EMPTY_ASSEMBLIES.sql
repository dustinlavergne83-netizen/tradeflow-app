-- Delete the 10 empty assemblies that were created without components
DELETE FROM assemblies 
WHERE name IN (
  '1/2" EMT with 3-#12 THHN',
  '3/4" EMT with 4-#12 THHN',
  '1" EMT with 3-#10 THHN',
  '1" EMT with 4-#8 THHN',
  '1-1/4" EMT with 3-#6 THHN',
  '1-1/2" EMT with 4-#6 THHN',
  '2" EMT with 3-#2 THHN',
  '2" EMT with 4-#1 THHN',
  '2-1/2" EMT with 3-#1/0 THHN',
  '3" EMT with 4-#2/0 THHN'
)
AND company_id = '3c75eb59-0549-46cb-b8d2-3a006a7a6c9a';
