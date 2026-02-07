-- Check if the 10 EMT assemblies exist and if they have components
SELECT 
    a.id,
    a.name,
    a.created_at,
    COUNT(ac.id) as component_count
FROM assemblies a
LEFT JOIN assembly_components ac ON a.id = ac.assembly_id
WHERE a.name LIKE '%EMT with%'
  AND a.company_id = '3c75eb59-0549-46cb-b8d2-3a006a7a6c9a'
GROUP BY a.id, a.name, a.created_at
ORDER BY a.created_at DESC;
