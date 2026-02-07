-- Add export tracking to measurement_layers
ALTER TABLE measurement_layers 
ADD COLUMN IF NOT EXISTS needs_export BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS last_exported_at TIMESTAMPTZ;

-- Set all existing predefined layers to need export
UPDATE measurement_layers 
SET needs_export = true 
WHERE is_predefined = true;
