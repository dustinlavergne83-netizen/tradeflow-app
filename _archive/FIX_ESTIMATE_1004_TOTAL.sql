-- Fix the total for estimate 1004
-- This will recalculate the total based on the estimate summary data

UPDATE estimates
SET total = (
    -- Materials subtotal
    COALESCE(material_subtotal, 0) +
    
    -- Labor total (hours * rate * (1 + markup))
    COALESCE(labor_hours_total, 0) * 
    COALESCE(labor_cost_rate, 25) * 
    (1 + COALESCE(labor_multiplier, 0.5)) +
    
    -- Fees & Equipment
    COALESCE(mobilization, 0) +
    COALESCE(room_board, 0) +
    COALESCE(equipment_rental, 0) +
    COALESCE(material_storage, 0) +
    COALESCE(misc_expenses, 0) +
    COALESCE(permit_fees, 0) +
    
    -- Packages
    COALESCE(lighting_package_cost, 0) * (1 + COALESCE(lighting_package_markup, 0) / 100.0) +
    COALESCE(switchgear_package_cost, 0) * (1 + COALESCE(switchgear_package_markup, 0) / 100.0) +
    COALESCE(special_systems_cost, 0) * (1 + COALESCE(special_systems_markup, 0) / 100.0) +
    COALESCE(subcontractors_cost, 0) * (1 + COALESCE(subcontractors_markup, 0) / 100.0)
),
subtotal = (
    -- Same as total but this is typically pre-markup in your system
    COALESCE(material_subtotal, 0) +
    COALESCE(labor_hours_total, 0) * COALESCE(labor_cost_rate, 25) +
    COALESCE(mobilization, 0) +
    COALESCE(room_board, 0) +
    COALESCE(equipment_rental, 0) +
    COALESCE(material_storage, 0) +
    COALESCE(misc_expenses, 0) +
    COALESCE(permit_fees, 0) +
    COALESCE(lighting_package_cost, 0) +
    COALESCE(switchgear_package_cost, 0) +
    COALESCE(special_systems_cost, 0) +
    COALESCE(subcontractors_cost, 0)
)
WHERE estimate_number = '1004';

-- Verify the fix
SELECT 
    estimate_number,
    material_subtotal,
    labor_hours_total,
    labor_cost_rate,
    labor_multiplier,
    subtotal,
    total,
    -- Show calculated total for verification
    (
        COALESCE(material_subtotal, 0) +
        COALESCE(labor_hours_total, 0) * 
        COALESCE(labor_cost_rate, 25) * 
        (1 + COALESCE(labor_multiplier, 0.5)) +
        COALESCE(mobilization, 0) +
        COALESCE(room_board, 0) +
        COALESCE(equipment_rental, 0) +
        COALESCE(material_storage, 0) +
        COALESCE(misc_expenses, 0) +
        COALESCE(permit_fees, 0) +
        COALESCE(lighting_package_cost, 0) * (1 + COALESCE(lighting_package_markup, 0) / 100.0) +
        COALESCE(switchgear_package_cost, 0) * (1 + COALESCE(switchgear_package_markup, 0) / 100.0) +
        COALESCE(special_systems_cost, 0) * (1 + COALESCE(special_systems_markup, 0) / 100.0) +
        COALESCE(subcontractors_cost, 0) * (1 + COALESCE(subcontractors_markup, 0) / 100.0)
    ) as calculated_total
FROM estimates
WHERE estimate_number = '1004';
