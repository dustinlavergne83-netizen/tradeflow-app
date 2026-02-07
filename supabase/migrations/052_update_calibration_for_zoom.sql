-- Add zoom-independent calibration fields to plan_calibrations table
ALTER TABLE plan_calibrations 
ADD COLUMN IF NOT EXISTS pixels_per_foot_at_100 NUMERIC,
ADD COLUMN IF NOT EXISTS calibration_pixel_distance NUMERIC,
ADD COLUMN IF NOT EXISTS calibration_real_distance NUMERIC,
ADD COLUMN IF NOT EXISTS calibration_zoom_level NUMERIC DEFAULT 1.0;

-- Add comment explaining the new approach
COMMENT ON COLUMN plan_calibrations.pixels_per_foot_at_100 IS 'The number of pixels per foot at 100% zoom level. Used to calculate measurements at any zoom level.';
COMMENT ON COLUMN plan_calibrations.calibration_pixel_distance IS 'The pixel distance measured during calibration';
COMMENT ON COLUMN plan_calibrations.calibration_real_distance IS 'The real-world distance (in feet) that the calibration line represents';
COMMENT ON COLUMN plan_calibrations.calibration_zoom_level IS 'The zoom level when calibration was performed (1.0 = 100%)';
