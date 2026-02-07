-- Add location tracking columns to shifts table
ALTER TABLE shifts
ADD COLUMN IF NOT EXISTS clock_in_latitude DECIMAL(10, 8),
ADD COLUMN IF NOT EXISTS clock_in_longitude DECIMAL(11, 8),
ADD COLUMN IF NOT EXISTS clock_in_accuracy DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS clock_out_latitude DECIMAL(10, 8),
ADD COLUMN IF NOT EXISTS clock_out_longitude DECIMAL(11, 8),
ADD COLUMN IF NOT EXISTS clock_out_accuracy DECIMAL(10, 2);

-- Add location tracking columns to shift_segments table
ALTER TABLE shift_segments
ADD COLUMN IF NOT EXISTS start_latitude DECIMAL(10, 8),
ADD COLUMN IF NOT EXISTS start_longitude DECIMAL(11, 8),
ADD COLUMN IF NOT EXISTS start_accuracy DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS end_latitude DECIMAL(10, 8),
ADD COLUMN IF NOT EXISTS end_longitude DECIMAL(11, 8),
ADD COLUMN IF NOT EXISTS end_accuracy DECIMAL(10, 2);

-- Add comment to document the location tracking feature
COMMENT ON COLUMN shifts.clock_in_latitude IS 'GPS latitude when clocked in';
COMMENT ON COLUMN shifts.clock_in_longitude IS 'GPS longitude when clocked in';
COMMENT ON COLUMN shifts.clock_in_accuracy IS 'GPS accuracy in meters when clocked in';
COMMENT ON COLUMN shifts.clock_out_latitude IS 'GPS latitude when clocked out';
COMMENT ON COLUMN shifts.clock_out_longitude IS 'GPS longitude when clocked out';
COMMENT ON COLUMN shifts.clock_out_accuracy IS 'GPS accuracy in meters when clocked out';
