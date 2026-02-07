-- Create table to store continuous location tracking while clocked in
CREATE TABLE IF NOT EXISTS location_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id UUID NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  accuracy DECIMAL(10, 2),
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_location_history_shift_id ON location_history(shift_id);
CREATE INDEX IF NOT EXISTS idx_location_history_user_id ON location_history(user_id);
CREATE INDEX IF NOT EXISTS idx_location_history_recorded_at ON location_history(recorded_at);

-- Enable RLS
ALTER TABLE location_history ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own location history
CREATE POLICY "Users can view own location history"
  ON location_history
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Users can insert their own location history
CREATE POLICY "Users can insert own location history"
  ON location_history
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy: Admins can view all location history
CREATE POLICY "Admins can view all location history"
  ON location_history
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM employees
      WHERE employees.user_id = auth.uid()
      AND employees.role = 'admin'
    )
  );

-- Add comment
COMMENT ON TABLE location_history IS 'Stores periodic GPS location updates while employees are clocked in';
