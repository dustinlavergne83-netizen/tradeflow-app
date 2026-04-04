-- ============================================================
-- TRADEFLOW COMMUNICATIONS HUB
-- Twilio SMS + Voice + AI Call Logging
-- ============================================================

-- Communications log (every call, text, AI conversation)
CREATE TABLE IF NOT EXISTS communications (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id      uuid REFERENCES companies(id) ON DELETE CASCADE,
  customer_id     uuid REFERENCES customers(id) ON DELETE SET NULL,
  project_id      uuid REFERENCES projects(id) ON DELETE SET NULL,

  -- Type & direction
  type            text NOT NULL CHECK (type IN ('sms', 'call', 'ai_call')),
  direction       text NOT NULL CHECK (direction IN ('inbound', 'outbound')),

  -- Participants
  from_number     text NOT NULL,
  to_number       text NOT NULL,
  customer_name   text, -- cached for display even if no customer record

  -- Content
  body            text,           -- SMS body OR AI chat summary
  duration_seconds integer,       -- call duration
  recording_url   text,           -- call recording
  transcript      jsonb,          -- full AI conversation transcript [{role, content}]
  ai_summary      text,           -- AI-generated summary of the call

  -- Status
  status          text DEFAULT 'completed', -- completed | missed | failed
  read_at         timestamptz,    -- NULL = unread

  -- Twilio reference
  twilio_sid      text UNIQUE,

  created_at      timestamptz DEFAULT now()
);

-- Twilio configuration per company
CREATE TABLE IF NOT EXISTS twilio_config (
  id                    uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id            uuid REFERENCES companies(id) ON DELETE CASCADE UNIQUE,
  account_sid           text NOT NULL,
  auth_token            text NOT NULL,
  phone_number          text NOT NULL,   -- e.g. +13372880395

  -- Business hours (after-hours AI kicks in)
  business_hours_start  integer DEFAULT 7,   -- 7am
  business_hours_end    integer DEFAULT 18,  -- 6pm
  business_days         text[] DEFAULT ARRAY['Mon','Tue','Wed','Thu','Fri'],
  timezone              text DEFAULT 'America/Chicago',

  -- AI settings
  ai_enabled            boolean DEFAULT true,
  forward_to_number     text,   -- your cell for emergency forward

  -- After-hours SMS auto-reply
  sms_auto_reply_enabled  boolean DEFAULT true,
  sms_auto_reply_message  text DEFAULT 'Thanks for texting DML Electrical! We received your message and will respond during business hours (Mon-Fri 7am-6pm). For emergencies call (337) 288-0395.',

  created_at            timestamptz DEFAULT now(),
  updated_at            timestamptz DEFAULT now()
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_communications_company     ON communications(company_id);
CREATE INDEX IF NOT EXISTS idx_communications_customer    ON communications(customer_id);
CREATE INDEX IF NOT EXISTS idx_communications_from        ON communications(from_number);
CREATE INDEX IF NOT EXISTS idx_communications_type        ON communications(type);
CREATE INDEX IF NOT EXISTS idx_communications_created     ON communications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_communications_unread      ON communications(company_id, read_at) WHERE read_at IS NULL;

-- Enable RLS
ALTER TABLE communications ENABLE ROW LEVEL SECURITY;
ALTER TABLE twilio_config  ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "company_comms" ON communications;
CREATE POLICY "company_comms" ON communications
  USING (company_id IN (
    SELECT company_id FROM employees WHERE user_id = auth.uid()
    UNION
    SELECT id FROM companies WHERE owner_id = auth.uid()
  ));

DROP POLICY IF EXISTS "company_twilio_config" ON twilio_config;
CREATE POLICY "company_twilio_config" ON twilio_config
  USING (company_id IN (
    SELECT company_id FROM employees WHERE user_id = auth.uid()
    UNION
    SELECT id FROM companies WHERE owner_id = auth.uid()
  ));

-- View: conversation threads (latest message per phone number)
CREATE OR REPLACE VIEW communication_threads AS
SELECT DISTINCT ON (company_id, LEAST(from_number, to_number), GREATEST(from_number, to_number))
  id,
  company_id,
  customer_id,
  customer_name,
  from_number,
  to_number,
  type,
  direction,
  body,
  ai_summary,
  status,
  read_at,
  created_at,
  -- The "other" number (not our business number)
  CASE WHEN direction = 'inbound' THEN from_number ELSE to_number END AS contact_number
FROM communications
ORDER BY company_id, LEAST(from_number, to_number), GREATEST(from_number, to_number), created_at DESC;

COMMENT ON TABLE communications IS 'Every call and SMS to/from customers, including AI call transcripts';
COMMENT ON TABLE twilio_config   IS 'Twilio credentials and business hours settings per company';
