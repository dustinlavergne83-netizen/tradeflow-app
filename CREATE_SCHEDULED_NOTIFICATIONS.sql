-- ============================================================
-- SCHEDULED NOTIFICATIONS SETUP  (run in Supabase SQL Editor)
-- Run each STEP block separately.
-- ============================================================

-- ── STEP 1: Create the table ─────────────────────────────────
CREATE TABLE IF NOT EXISTS scheduled_notifications (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id          TEXT NOT NULL,
  title               TEXT NOT NULL DEFAULT 'TradeFlow',
  message             TEXT NOT NULL,
  send_time           TIME NOT NULL,
  timezone            TEXT NOT NULL DEFAULT 'America/Chicago',
  days_of_week        INTEGER[] NOT NULL DEFAULT '{1,2,3,4,5}',
  notify_all          BOOLEAN NOT NULL DEFAULT true,
  notify_employee_ids TEXT[] DEFAULT '{}',
  enabled             BOOLEAN NOT NULL DEFAULT true,
  last_sent_at        TIMESTAMPTZ,
  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now()
);


-- ── STEP 2: Create the scheduler function ────────────────────
-- Replace the two placeholder values below:
--   YOUR_PROJECT_URL  → e.g. https://hyhjxdgdetdqoyoscflu.supabase.co
--   YOUR_ANON_KEY     → Supabase Dashboard → Settings → API → anon / public
-- (The anon key is safe to embed — it's already public in your JS app.
--  The edge function uses the service_role_key internally via env vars.)

CREATE OR REPLACE FUNCTION fire_scheduled_notifications()
RETURNS void
LANGUAGE plpgsql
AS $func$
DECLARE
  v_rec        RECORD;
  v_day        INTEGER;
  v_localtime  TIME;
  v_url        TEXT := 'https://YOUR_PROJECT_URL.supabase.co/functions/v1/send-scheduled-notification';
  v_anonkey    TEXT := 'YOUR_ANON_KEY';
BEGIN
  FOR v_rec IN
    SELECT * FROM scheduled_notifications WHERE enabled = true
  LOOP
    v_localtime := (now() AT TIME ZONE v_rec.timezone)::TIME;
    v_day       := EXTRACT(DOW FROM (now() AT TIME ZONE v_rec.timezone))::INTEGER;

    IF v_day = ANY(v_rec.days_of_week)
      AND date_trunc('minute', v_localtime) = date_trunc('minute', v_rec.send_time)
      AND (v_rec.last_sent_at IS NULL OR v_rec.last_sent_at < now() - INTERVAL '55 seconds')
    THEN
      PERFORM net.http_post(
        url     := v_url,
        headers := jsonb_build_object(
          'Content-Type',  'application/json',
          'Authorization', 'Bearer ' || v_anonkey
        ),
        body    := jsonb_build_object(
          'schedule_id',         v_rec.id::text,
          'company_id',          v_rec.company_id,
          'title',               v_rec.title,
          'message',             v_rec.message,
          'notify_all',          v_rec.notify_all,
          'notify_employee_ids', v_rec.notify_employee_ids
        )
      );

      UPDATE scheduled_notifications
        SET last_sent_at = now(),
            updated_at   = now()
        WHERE id = v_rec.id;
    END IF;
  END LOOP;
END;
$func$;


-- ── STEP 3: Enable extensions then create the cron job ───────
-- First go to: Dashboard → Database → Extensions
--   Enable: pg_cron   (shows as "pg_cron")
--   Enable: pg_net    (shows as "pg_net" or "HTTP")
-- Then run this:

SELECT cron.schedule(
  'fire-scheduled-notifications',
  '* * * * *',
  'SELECT fire_scheduled_notifications()'
);


-- ── Useful debug commands ─────────────────────────────────────
-- Test right now:  SELECT fire_scheduled_notifications();
-- List cron jobs:  SELECT * FROM cron.job;
-- Remove job:      SELECT cron.unschedule('fire-scheduled-notifications');
