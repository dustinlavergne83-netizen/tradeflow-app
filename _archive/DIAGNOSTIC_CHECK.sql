-- ================================================
-- DIAGNOSTIC CHECK - Run these to see what's wrong
-- ================================================

-- CHECK #1: See your estimates and which one is the change order
SELECT 
    id,
    estimate_number,
    project_name,
    created_at,
    CASE 
        WHEN estimate_number LIKE '%CO-%' THEN '✓ CHANGE ORDER'
        ELSE '✗ Regular Estimate'
    END as estimate_type
FROM estimates
ORDER BY created_at DESC
LIMIT 10;

-- CHECK #2: See your estimate items and their sections
SELECT 
    id,
    estimate_id,
    section,
    description,
    quantity,
    material_unit_cost,
    labor_hours,
    sequence
FROM estimate_items
WHERE estimate_id IN (
    SELECT id FROM estimates 
    ORDER BY created_at DESC 
    LIMIT 3
)
ORDER BY estimate_id, sequence;

-- CHECK #3: Count items by section for your most recent estimate
SELECT 
    section,
    COUNT(*) as item_count,
    SUM(material_total) as total_materials,
    SUM(labor_hours * quantity) as total_hours
FROM estimate_items
WHERE estimate_id = (
    SELECT id FROM estimates 
    ORDER BY created_at DESC 
    LIMIT 1
)
GROUP BY section;

-- ================================================
-- COPY AND PASTE THE RESULTS HERE AND I'LL TELL YOU THE FIX
-- ================================================
