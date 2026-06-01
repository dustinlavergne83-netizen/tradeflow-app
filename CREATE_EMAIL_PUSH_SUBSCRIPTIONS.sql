-- ─────────────────────────────────────────────────────────────
-- Email Push Subscriptions
-- Stores Microsoft refresh tokens + Expo push tokens so the
-- check-new-emails edge function can poll Graph API every minute
-- and send push notifications for new emails.
-- ─────────────────────────────────────────────────────────────

create table if not exists email_push_subscriptions (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  expo_push_token  text not null,
  ms_refresh_token text not null,
  last_email_id    text,          -- Graph message ID of last notified email
  last_checked_at  timestamptz default now(),
  created_at       timestamptz default now(),
  updated_at       timestamptz default now(),
  unique (user_id)               -- one row per user, upserted on each sign-in
);

-- RLS: users can only read/write their own row
alter table email_push_subscriptions enable row level security;

create policy "own row only" on email_push_subscriptions
  for all using (auth.uid() = user_id);

-- Service role bypass (needed by the edge function)
create policy "service role full access" on email_push_subscriptions
  for all to service_role using (true);

-- ─────────────────────────────────────────────────────────────
-- pg_cron job: call check-new-emails every 1 minute
-- Run this AFTER deploying the edge function.
-- ─────────────────────────────────────────────────────────────

select cron.schedule(
  'check-new-emails',
  '* * * * *',
  $$
  select
    net.http_post(
      url    := (select decrypted_secret from vault.decrypted_secrets where name = 'supabase_url') || '/functions/v1/check-new-emails',
      body   := '{}',
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')
      )
    );
  $$
);

-- ─────────────────────────────────────────────────────────────
-- Alternative simpler cron (if vault secrets aren't set up):
-- Replace YOUR_PROJECT_REF and YOUR_SERVICE_ROLE_KEY below
-- ─────────────────────────────────────────────────────────────

-- select cron.schedule(
--   'check-new-emails',
--   '* * * * *',
--   $$
--   select net.http_post(
--     url    := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/check-new-emails',
--     body   := '{}',
--     headers := '{"Content-Type":"application/json","Authorization":"Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb
--   );
--   $$
-- );
