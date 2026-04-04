-- Add recording/voicemail columns to communications table
-- Run in Supabase SQL editor

ALTER TABLE communications
  ADD COLUMN IF NOT EXISTS recording_url TEXT,
  ADD COLUMN IF NOT EXISTS recording_sid TEXT,
  ADD COLUMN IF NOT EXISTS recording_enabled BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS call_sid TEXT,
  ADD COLUMN IF NOT EXISTS duration_seconds INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ;

-- Index for call_sid lookups (used by recording callback)
CREATE INDEX IF NOT EXISTS idx_communications_call_sid ON communications(call_sid);

-- Index for unread messages
CREATE INDEX IF NOT EXISTS idx_communications_read_at ON communications(read_at) WHERE read_at IS NULL;

SELECT 'Recording columns added successfully' as status;
