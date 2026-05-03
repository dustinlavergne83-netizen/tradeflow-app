-- Run this in Supabase SQL Editor
-- Adds custom notification message columns to geofence_notification_settings

ALTER TABLE geofence_notification_settings
  ADD COLUMN IF NOT EXISTS enter_message_self   TEXT DEFAULT 'You''ve arrived at {{fence}}',
  ADD COLUMN IF NOT EXISTS exit_message_self    TEXT DEFAULT 'You''ve left {{fence}}',
  ADD COLUMN IF NOT EXISTS enter_message_others TEXT DEFAULT '{{name}} arrived at {{fence}}',
  ADD COLUMN IF NOT EXISTS exit_message_others  TEXT DEFAULT '{{name}} left {{fence}}';
