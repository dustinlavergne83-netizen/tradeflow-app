-- Run this in your Supabase SQL editor
-- Creates a table for named geofence locations (Shop, Warehouse, etc.) not tied to a project

CREATE TABLE IF NOT EXISTS company_locations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    UUID NOT NULL,
  name          TEXT NOT NULL,              -- e.g. "Shop", "Warehouse", "Main Office"
  address       TEXT,
  geofence_latitude    NUMERIC(10, 7),
  geofence_longitude   NUMERIC(10, 7),
  geofence_radius_meters INTEGER DEFAULT 200,
  geofence_enabled BOOLEAN DEFAULT false,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE company_locations ENABLE ROW LEVEL SECURITY;

-- Policy: users can only see/edit their own company's locations
CREATE POLICY "company_locations_company_access"
  ON company_locations
  FOR ALL
  USING (company_id = auth.uid())
  WITH CHECK (company_id = auth.uid());

-- Index for fast lookup by company
CREATE INDEX IF NOT EXISTS idx_company_locations_company_id ON company_locations(company_id);
