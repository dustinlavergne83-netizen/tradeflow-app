-- Find out what sections your CO-02 items actually have
SELECT 
    section,
    COUNT(*) as item_count,
    SUM(material_total) as total_materials,
    SUM(labor_total) as total_labor,
    SUM(material_total + labor_total) as grand_total
FROM estimate_items
WHERE estimate_id = (
    SELECT id 
    FROM estimates 
    WHERE estimate_number = 'CO-02'
    LIMIT 1
)
GROUP BY section
ORDER BY section;

-- This will show you EXACTLY what section value is in the database
-- I bet it's NULL or 'general' instead of 'lighting', 'power', etc.
