-- ============================================================
-- FIX SCHEDULED NOTIFICATIONS — AUTOMATIC CRON
-- Run ALL of this in Supabase SQL Editor (Dashboard → SQL Editor)
-- ============================================================
-- 
-- ROOT CAUSE: The fire_scheduled_notifications() function was
-- created with placeholder values (YOUR_PROJECT_URL / YOUR_ANON_KEY)
-- instead of the real credentials. The cron job ran every minute
-- but called the wrong URL, so nothing was sent automatically.
-- "Send Now" worked because the React app called the edge function
-- directly — the broken SQL function was never involved.
--
-- This script fixes the function with your real credentials and
-- ensures the cron job is properly registered.
-- ============================================================

-- ── STEP 1: Make sure required extensions are enabled ────────
-- (If these error, go to Dashboard → Database → Extensions and
--  enable pg_cron and pg_net manually, then rerun.)
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;


-- ── STEP 2: Recreate the scheduler function with REAL values ─
CREATE OR REPLACE FUNCTION fire_scheduled_notifications()
RETURNS void
LANGUAGE plpgsql
AS $func$
DECLARE
  v_rec        RECORD;
  v_day        INTEGER;
  v_localtime  TIME;
  v_url        TEXT := 'https://hyhjxdgdetdqoyoscflu.supabase.co/functions/v1/send-scheduled-notification';
  v_anonkey    TEXT := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh5aGp4ZGdkZXRkcW95b3NjZmx1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU4MjQ0NDUsImV4cCI6MjA4MTQwMDQ0NX0.kuEyoo4q-7utRafZHqjPD2lndBm-vRyUPeVqjkfDUF4';
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

      RAISE LOG 'Fired scheduled notification id=% at %', v_rec.id, now();
    END IF;
  END LOOP;
END;
$func$;


-- ── STEP 3: Remove old/broken cron job (if it exists) ────────
SELECT cron.unschedule('fire-scheduled-notifications');


-- ── STEP 4: Register the cron job — runs every minute ────────
SELECT cron.schedule(
  'fire-scheduled-notifications',
  '* * * * *',
  'SELECT fire_scheduled_notifications()'
);


-- ── STEP 5: Verify everything looks correct ──────────────────
-- You should see the job listed with schedule '* * * * *'
SELECT jobid, jobname, schedule, command, active
FROM cron.job
WHERE jobname = 'fire-scheduled-notifications';


-- ── STEP 6: Test it right now ────────────────────────────────
-- Temporarily set your 7:30 schedule to the current minute,
-- run this, then change it back — OR just trust the fix and
-- wait for the next scheduled minute.
--
-- To manually test at any time:
--   SELECT fire_scheduled_notifications();
--
-- To see recent cron run history:
--   SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 20;
