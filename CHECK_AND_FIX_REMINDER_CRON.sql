-- ============================================================
-- Step 1: Check if cron job is already running
-- ============================================================
select jobname, schedule, active from cron.job where jobname = 'send-ai-reminder-sms';
-- If you see a row → cron IS running (check send-ai-reminders function logs)
-- If empty → cron NOT set up yet → run Step 2 below

-- ============================================================
-- Step 2: Set up the cron job (run this if Step 1 returned nothing)
-- ============================================================
select cron.schedule(
  'send-ai-reminder-sms',
  '* * * * *',
  $$
  select
    net.http_post(
      url      := 'https://hyhjxdgdetdqoyoscflu.supabase.co/functions/v1/send-ai-reminders',
      headers  := '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh5aGp4ZGdkZXRkcW95b3NjZmx1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU4MjQ0NDUsImV4cCI6MjA4MTQwMDQ0NX0.kuEyoo4q-7utRafZHqjPD2lndBm-vRyUPeVqjkfDUF4"}'::jsonb,
      body     := '{}'::jsonb
    ) as request_id;
  $$
);

-- ============================================================
-- Step 3: Check what reminders are saved (to verify AI saved them)
-- ============================================================
select id, user_id, message, remind_at, is_done
from ai_reminders
order by created_at desc
limit 10;

-- ============================================================
-- Step 4: Make sure is_done column exists
-- ============================================================
alter table ai_reminders add column if not exists is_done boolean default false;

-- ============================================================
-- Step 5: Force-fire any overdue reminders right now
-- (sets is_done=false so the cron will pick them up next minute)
-- ============================================================
update ai_reminders set is_done = false
where remind_at <= now() and is_done = true;
