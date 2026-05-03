-- ============================================================
-- Run this in your Supabase SQL Editor
-- Creates tables needed for geofence push notifications
-- ============================================================

-- 1. Employee push tokens (stores Expo push tokens from the mobile app)
CREATE TABLE IF NOT EXISTS employee_push_tokens (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL,
  employee_id    UUID,
  expo_push_token TEXT NOT NULL,
  device_name    TEXT,
  created_at     TIMESTAMPTZ DEFAULT now(),
  updated_at     TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, expo_push_token)
);

ALTER TABLE employee_push_tokens ENABLE ROW LEVEL SECURITY;

-- Allow employees to manage their own tokens
CREATE POLICY "employee_push_tokens_own"
  ON employee_push_tokens
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Allow company admins (via service role) to read all tokens for their company
-- Service role bypasses RLS so the edge function can read all tokens


-- 2. Geofence notification settings (per fence)
CREATE TABLE IF NOT EXISTS geofence_notification_settings (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id           UUID NOT NULL,
  fence_type           TEXT NOT NULL CHECK (fence_type IN ('project', 'company_location')),
  fence_id             UUID NOT NULL,
  notify_on_enter      BOOLEAN DEFAULT true,
  notify_on_exit       BOOLEAN DEFAULT true,
  notify_all_employees BOOLEAN DEFAULT true,
  notify_employee_ids  UUID[] DEFAULT '{}',
  created_at           TIMESTAMPTZ DEFAULT now(),
  updated_at           TIMESTAMPTZ DEFAULT now(),
  UNIQUE(fence_type, fence_id)
);

ALTER TABLE geofence_notification_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "geofence_notifications_company"
  ON geofence_notification_settings
  FOR ALL
  USING (company_id = auth.uid())
  WITH CHECK (company_id = auth.uid());

-- Indexes
CREATE INDEX IF NOT EXISTS idx_push_tokens_user ON employee_push_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_geofence_notif_fence ON geofence_notification_settings(fence_type, fence_id);
CREATE INDEX IF NOT EXISTS idx_geofence_notif_company ON geofence_notification_settings(company_id);
