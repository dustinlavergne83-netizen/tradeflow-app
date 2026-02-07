-- Create admin_notifications table
CREATE TABLE IF NOT EXISTS admin_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  data JSONB,
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_admin_notifications_user_id ON admin_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_admin_notifications_read ON admin_notifications(read);
CREATE INDEX IF NOT EXISTS idx_admin_notifications_created_at ON admin_notifications(created_at DESC);

-- Add RLS policies
ALTER TABLE admin_notifications ENABLE ROW LEVEL SECURITY;

-- Users can see their own notifications
CREATE POLICY "Users can view own notifications" ON admin_notifications
  FOR SELECT USING (user_id = auth.uid());

-- Users can mark their own notifications as read
CREATE POLICY "Users can update own notifications" ON admin_notifications
  FOR UPDATE USING (user_id = auth.uid());

-- System can insert notifications
CREATE POLICY "System can insert notifications" ON admin_notifications
  FOR INSERT WITH CHECK (true);

-- Create function to call edge function for geofence notifications
CREATE OR REPLACE FUNCTION notify_geofence_event()
RETURNS TRIGGER AS $$
DECLARE
  function_url TEXT;
  service_role_key TEXT;
  payload JSONB;
BEGIN
  -- Get the Supabase URL and service role key from environment
  function_url := current_setting('app.settings.supabase_url', true) || '/functions/v1/notify-geofence-event';
  service_role_key := current_setting('app.settings.service_role_key', true);
  
  -- Build payload
  payload := jsonb_build_object('event_id', NEW.id);
  
  -- Call edge function asynchronously using pg_net
  PERFORM
    net.http_post(
      url := function_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || service_role_key
      ),
      body := payload
    );
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail the insert
    RAISE WARNING 'Failed to call geofence notification function: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on geofence_events table
DROP TRIGGER IF EXISTS on_geofence_event_created ON geofence_events;
CREATE TRIGGER on_geofence_event_created
  AFTER INSERT ON geofence_events
  FOR EACH ROW
  EXECUTE FUNCTION notify_geofence_event();

-- Create a function to get unread notification count
CREATE OR REPLACE FUNCTION get_unread_notification_count(user_uuid UUID)
RETURNS INTEGER AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)::INTEGER
    FROM admin_notifications
    WHERE user_id = user_uuid AND read = false
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
