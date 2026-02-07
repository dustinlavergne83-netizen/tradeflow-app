-- Add geofence columns to projects table
ALTER TABLE projects
ADD COLUMN IF NOT EXISTS geofence_latitude DECIMAL(10, 8),
ADD COLUMN IF NOT EXISTS geofence_longitude DECIMAL(11, 8),
ADD COLUMN IF NOT EXISTS geofence_radius_meters INTEGER DEFAULT 200,
ADD COLUMN IF NOT EXISTS geofence_enabled BOOLEAN DEFAULT false;

-- Create geofence events table
CREATE TABLE IF NOT EXISTS geofence_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('entry', 'exit')),
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  accuracy DECIMAL(10, 2),
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  employee_action TEXT CHECK (employee_action IN ('clocked_in', 'clocked_out', 'started_lunch', 'ended_lunch', 'dismissed', 'no_action')),
  admin_notified BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_geofence_events_user_id ON geofence_events(user_id);
CREATE INDEX IF NOT EXISTS idx_geofence_events_employee_id ON geofence_events(employee_id);
CREATE INDEX IF NOT EXISTS idx_geofence_events_project_id ON geofence_events(project_id);
CREATE INDEX IF NOT EXISTS idx_geofence_events_timestamp ON geofence_events(timestamp);
CREATE INDEX IF NOT EXISTS idx_geofence_events_type ON geofence_events(event_type);

-- Add RLS policies
ALTER TABLE geofence_events ENABLE ROW LEVEL SECURITY;

-- Admins can see all events
CREATE POLICY "Admins can view all geofence events" ON geofence_events
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Employees can see their own events
CREATE POLICY "Employees can view own geofence events" ON geofence_events
  FOR SELECT USING (user_id = auth.uid());

-- System can insert events (from mobile app)
CREATE POLICY "Allow insert geofence events" ON geofence_events
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- Admins can update events (for marking as notified)
CREATE POLICY "Admins can update geofence events" ON geofence_events
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );
