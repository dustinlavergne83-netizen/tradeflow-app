-- ============================================================
-- AI Reminders SMS Cron Setup
-- Run this in Supabase SQL Editor once.
-- It calls send-ai-reminders every minute to fire due reminders
-- via AT&T email-to-SMS (free, no Twilio needed).
-- ============================================================

-- 1. Enable pg_net if not already enabled (needed to call Edge Functions)
create extension if not exists pg_net;

-- 2. Enable pg_cron if not already enabled
create extension if not exists pg_cron;

-- 3. Remove old job if it exists (safe — won't error if not found)
select cron.unschedule(jobid) from cron.job where jobname = 'send-ai-reminder-sms';

-- 4. Schedule: every minute, call the Edge Function
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

-- 5. Verify it was scheduled
select jobname, schedule, command from cron.job where jobname = 'send-ai-reminder-sms';

-- ============================================================
-- Also make sure ai_reminders table has all needed columns:
-- ============================================================
alter table ai_reminders add column if not exists is_done boolean default false;
alter table ai_reminders add column if not exists user_id uuid references auth.users(id);

-- Index for fast lookups of due reminders
create index if not exists idx_ai_reminders_due
  on ai_reminders (is_done, remind_at)
  where is_done = false;
