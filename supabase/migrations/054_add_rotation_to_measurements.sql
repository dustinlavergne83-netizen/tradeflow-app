-- Add rotation column to plan_measurements table
ALTER TABLE plan_measurements
ADD COLUMN IF NOT EXISTS rotation INTEGER DEFAULT 0;

-- Add comment explaining rotation values
COMMENT ON COLUMN plan_measurements.rotation IS 'PDF rotation in degrees: 0, 90, 180, or 270';
