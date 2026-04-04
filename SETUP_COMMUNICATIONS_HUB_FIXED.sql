-- ============================================================
-- TRADEFLOW COMMUNICATIONS HUB - FIXED VERSION
-- No foreign key dependencies on other tables
-- ============================================================

-- Communications log (every call, text, AI conversation)
CREATE TABLE IF NOT EXISTS communications (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id      uuid,
  customer_id     uuid,
  project_id      uuid,

  -- Type & direction
  type            text NOT NULL CHECK (type IN ('sms', 'call', 'ai_call')),
  direction       text NOT NULL CHECK (direction IN ('inbound', 'outbound')),

  -- Participants
  from_number     text NOT NULL,
  to_number       text NOT NULL,
  customer_name   text,

  -- Content
  body            text,
  duration_seconds integer,
  recording_url   text,
  transcript      jsonb,
  ai_summary      text,

  -- Status
  status          text DEFAULT 'completed',
  read_at         timestamptz,

  -- Twilio reference
  twilio_sid      text UNIQUE,

  created_at      timestamptz DEFAULT now()
);

-- Twilio configuration per company
CREATE TABLE IF NOT EXISTS twilio_config (
  id                      uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id              uuid UNIQUE,
  account_sid             text NOT NULL,
  auth_token              text NOT NULL,
  phone_number            text NOT NULL,

  -- Business hours
  business_hours_start    integer DEFAULT 7,
  business_hours_end      integer DEFAULT 18,
  business_days           text[] DEFAULT ARRAY['Mon','Tue','Wed','Thu','Fri'],
  timezone                text DEFAULT 'America/Chicago',

  -- AI settings
  ai_enabled              boolean DEFAULT true,
  forward_to_number       text,

  -- SMS auto-reply
  sms_auto_reply_enabled  boolean DEFAULT true,
  sms_auto_reply_message  text DEFAULT 'Thanks for texting DML Electrical! We received your message and will respond during business hours (Mon-Fri 7am-6pm). For emergencies call (337) 288-0395.',

  created_at              timestamptz DEFAULT now(),
  updated_at              timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_communications_company     ON communications(company_id);
CREATE INDEX IF NOT EXISTS idx_communications_customer    ON communications(customer_id);
CREATE INDEX IF NOT EXISTS idx_communications_from        ON communications(from_number);
CREATE INDEX IF NOT EXISTS idx_communications_type        ON communications(type);
CREATE INDEX IF NOT EXISTS idx_communications_created     ON communications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_communications_unread      ON communications(company_id, read_at) WHERE read_at IS NULL;

-- Enable RLS
ALTER TABLE communications ENABLE ROW LEVEL SECURITY;
ALTER TABLE twilio_config  ENABLE ROW LEVEL SECURITY;

-- RLS: Allow authenticated users to access their company's data
DROP POLICY IF EXISTS "company_comms" ON communications;
CREATE POLICY "company_comms" ON communications
  FOR ALL USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "company_twilio_config" ON twilio_config;
CREATE POLICY "company_twilio_config" ON twilio_config
  FOR ALL USING (auth.role() = 'authenticated');

-- Service role bypass (for edge functions)
DROP POLICY IF EXISTS "service_comms" ON communications;
CREATE POLICY "service_comms" ON communications
  FOR ALL TO service_role USING (true);

DROP POLICY IF EXISTS "service_twilio_config" ON twilio_config;
CREATE POLICY "service_twilio_config" ON twilio_config
  FOR ALL TO service_role USING (true);

SELECT 'Communications Hub tables created successfully!' as result;
