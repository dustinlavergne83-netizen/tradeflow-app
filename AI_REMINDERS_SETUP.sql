-- ============================================================
-- AI Assistant Database Setup
-- Run this in Supabase SQL Editor
-- ============================================================

-- ── 1. AI Reminders Table ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS ai_reminders (
  id            UUID          DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id    UUID,
  user_id       UUID          REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  message       TEXT          NOT NULL,
  remind_at     TIMESTAMPTZ   NOT NULL,
  is_done       BOOLEAN       DEFAULT FALSE,
  push_token    TEXT,
  push_sent     BOOLEAN       DEFAULT FALSE,
  created_at    TIMESTAMPTZ   DEFAULT NOW()
);

-- Row Level Security
ALTER TABLE ai_reminders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own reminders" ON ai_reminders;
CREATE POLICY "Users manage own reminders" ON ai_reminders
  FOR ALL USING (user_id = auth.uid());

-- Index for efficient cron job queries
CREATE INDEX IF NOT EXISTS idx_ai_reminders_due 
  ON ai_reminders (remind_at, push_sent, is_done) 
  WHERE push_sent = FALSE AND is_done = FALSE;

-- ── 2. AI Conversations Table ─────────────────────────────────
CREATE TABLE IF NOT EXISTS ai_conversations (
  id            UUID          DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       UUID          REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  company_id    UUID,
  role          TEXT          NOT NULL CHECK (role IN ('user', 'assistant')),
  content       TEXT          NOT NULL,
  action        TEXT,
  action_data   JSONB,
  transcript    TEXT,         -- Original voice transcript (if voice input)
  created_at    TIMESTAMPTZ   DEFAULT NOW()
);

ALTER TABLE ai_conversations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own conversations" ON ai_conversations;
CREATE POLICY "Users manage own conversations" ON ai_conversations
  FOR ALL USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_ai_conversations_user 
  ON ai_conversations (user_id, created_at DESC);

-- ── 3. Push Tokens Table ───────────────────────────────────────
-- Stores Expo push tokens per user (updated on each app open)
CREATE TABLE IF NOT EXISTS push_tokens (
  id            UUID          DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       UUID          REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
  token         TEXT          NOT NULL,
  device_type   TEXT,         -- 'ios' or 'android'
  updated_at    TIMESTAMPTZ   DEFAULT NOW()
);

ALTER TABLE push_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own push tokens" ON push_tokens;
CREATE POLICY "Users manage own push tokens" ON push_tokens
  FOR ALL USING (user_id = auth.uid());

-- ── 4. pg_cron Job for Push Notifications ─────────────────────
-- This calls the send-push-notification edge function every minute
-- REQUIRES: pg_cron extension enabled in Supabase
-- Enable at: Dashboard → Database → Extensions → pg_cron

-- First enable the extension (run separately if needed):
-- CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule the cron job to check every minute:
-- Replace YOUR_PROJECT_REF with your Supabase project ref (e.g., hyhjxdgdetdqoyoscflu)
-- Replace YOUR_SERVICE_ROLE_KEY with your service role key

/*
SELECT cron.schedule(
  'check-ai-reminders',
  '* * * * *',  -- every minute
  $$
  SELECT net.http_post(
    url := 'https://hyhjxdgdetdqoyoscflu.supabase.co/functions/v1/send-push-notification',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);
*/

-- ── 5. Verify Tables Were Created ─────────────────────────────
SELECT 
  table_name,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name AND table_schema = 'public') as column_count
FROM information_schema.tables t
WHERE table_schema = 'public' 
  AND table_name IN ('ai_reminders', 'ai_conversations', 'push_tokens')
ORDER BY table_name;
