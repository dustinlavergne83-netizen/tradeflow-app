-- ADD_TWILIO_CONFIG_COLUMNS.sql
-- Adds new AI phone settings columns to the twilio_config table
-- Run in Supabase SQL Editor

-- Add new columns (safe to run even if some already exist)
ALTER TABLE public.twilio_config
  ADD COLUMN IF NOT EXISTS business_number          text,
  ADD COLUMN IF NOT EXISTS emergency_forward_number text,
  ADD COLUMN IF NOT EXISTS owner_name               text DEFAULT 'Dustin',
  ADD COLUMN IF NOT EXISTS business_name            text DEFAULT 'DML Electrical Service',
  ADD COLUMN IF NOT EXISTS service_area             text,
  ADD COLUMN IF NOT EXISTS ai_greeting              text,
  ADD COLUMN IF NOT EXISTS vip_numbers              jsonb DEFAULT '[]'::jsonb;

-- Set defaults for existing rows
UPDATE public.twilio_config SET
  business_number          = COALESCE(business_number, '+13372880395'),
  emergency_forward_number = COALESCE(emergency_forward_number, forward_to_number),
  owner_name               = COALESCE(owner_name, 'Dustin'),
  business_name            = COALESCE(business_name, 'DML Electrical Service'),
  vip_numbers              = COALESCE(vip_numbers, '[]'::jsonb)
WHERE company_id IS NOT NULL;

SELECT 'twilio_config columns added!' as status;
