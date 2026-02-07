-- Check what sections your CO-02 items have
SELECT 
    section,
    COUNT(*) as item_count,
    SUM(material_total) as total_materials,
    SUM(labor_hours * quantity) as total_labor_hours
FROM estimate_items
WHERE estimate_id = (
    SELECT id 
    FROM estimates 
    WHERE estimate_number = 'CO-02'
    LIMIT 1
)
GROUP BY section;

-- This will show you which section your items are actually stored under
-- I bet they're all showing as 'general' instead of 'lighting', 'power', etc.
