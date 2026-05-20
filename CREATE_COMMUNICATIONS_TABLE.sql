-- ─────────────────────────────────────────────────────────────────────────────
-- CREATE_COMMUNICATIONS_TABLE.sql
-- Run this in Supabase SQL Editor to create the communications table
-- Used by: DML Comms app (recents tab) + twilio-voice-inbound function
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Create the communications table
CREATE TABLE IF NOT EXISTS public.communications (
  id               uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id       uuid,
  type             text NOT NULL DEFAULT 'call',   -- 'call', 'ai_call', 'voicemail', 'sms'
  direction        text NOT NULL DEFAULT 'inbound', -- 'inbound', 'outbound'
  from_number      text,
  to_number        text,
  customer_name    text,
  status           text DEFAULT 'completed',        -- 'ringing','completed','missed','voicemail','emergency','initiated'
  duration_seconds integer DEFAULT 0,
  recording_url    text,
  ai_summary       text,
  call_sid         text,                            -- Twilio CallSid for status callbacks
  read_at          timestamptz,                     -- null = unread (for voicemails)
  created_at       timestamptz DEFAULT now()
);

-- 2. Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_communications_company_id  ON public.communications (company_id);
CREATE INDEX IF NOT EXISTS idx_communications_from_number ON public.communications (from_number);
CREATE INDEX IF NOT EXISTS idx_communications_call_sid    ON public.communications (call_sid);
CREATE INDEX IF NOT EXISTS idx_communications_created_at  ON public.communications (created_at DESC);

-- 3. RLS
ALTER TABLE public.communications ENABLE ROW LEVEL SECURITY;

-- Service role has full access (used by Edge Functions)
CREATE POLICY "Service role full access" ON public.communications
  FOR ALL USING (true)
  WITH CHECK (true);

-- Authenticated users see their company's communications
CREATE POLICY "Company members can view their communications" ON public.communications
  FOR SELECT USING (
    company_id IN (
      SELECT company_id FROM public.employees WHERE user_id = auth.uid()
    )
  );

-- 4. Grant permissions
GRANT ALL ON public.communications TO service_role;
GRANT SELECT ON public.communications TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- DONE: Run this SQL, then deploy the Edge Functions
-- ─────────────────────────────────────────────────────────────────────────────
