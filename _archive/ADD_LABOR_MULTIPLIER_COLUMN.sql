-- Add labor_multiplier column to estimate_items table
-- This column stores the labor multiplier (e.g., 1.5 for 150% of base labor hours)

ALTER TABLE estimate_items 
ADD COLUMN IF NOT EXISTS labor_multiplier DECIMAL(10,2) DEFAULT 1.0;

-- Update any existing rows to have the default value
UPDATE estimate_items 
SET labor_multiplier = 1.0 
WHERE labor_multiplier IS NULL;

-- Add a check constraint to ensure multiplier is positive
ALTER TABLE estimate_items
ADD CONSTRAINT labor_multiplier_positive CHECK (labor_multiplier > 0);
