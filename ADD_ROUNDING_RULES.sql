-- Add rounding rules to base_materials table
-- This allows us to define how quantities should be rounded for each material

-- Add rounding_rule column to base_materials
ALTER TABLE base_materials
ADD COLUMN IF NOT EXISTS rounding_rule TEXT DEFAULT 'none';

-- Add comment explaining the field
COMMENT ON COLUMN base_materials.rounding_rule IS 
'Defines how quantities should be rounded: "none" (no rounding), "whole" (round up to whole number), "ten" (round up to nearest 10)';

-- Update all fittings to round to whole number
UPDATE base_materials
SET rounding_rule = 'whole'
WHERE category IN ('Fittings', 'Conduit Fittings', 'PVC Fittings')
   OR name ILIKE '%90%'
   OR name ILIKE '%45%'
   OR name ILIKE '%elbow%'
   OR name ILIKE '%ell%'
   OR name ILIKE '%LB%'
   OR name ILIKE '%LL%'
   OR name ILIKE '%LR%'
   OR name ILIKE '%body%'
   OR name ILIKE '%fitting%'
   OR name ILIKE '%box%'
   OR name ILIKE '%bushing%';

-- Update connectors, couplings, straps to round to whole number
UPDATE base_materials
SET rounding_rule = 'whole'
WHERE name ILIKE '%connector%'
   OR name ILIKE '%coupling%'
   OR name ILIKE '%strap%'
   OR name ILIKE '%clamp%';

-- Update conduit to round to nearest 10
UPDATE base_materials
SET rounding_rule = 'ten'
WHERE category = 'Conduit'
   OR name ILIKE '%EMT%'
   OR name ILIKE '%rigid%'
   OR name ILIKE '%IMC%'
   OR name ILIKE '%PVC%';

-- Verify the updates
SELECT 
  category,
  name,
  unit,
  rounding_rule
FROM base_materials
WHERE rounding_rule != 'none'
ORDER BY category, name
LIMIT 50;

-- Summary of rounding rules
SELECT 
  rounding_rule,
  COUNT(*) as material_count,
  STRING_AGG(DISTINCT category, ', ' ORDER BY category) as categories
FROM base_materials
GROUP BY rounding_rule
ORDER BY material_count DESC;
