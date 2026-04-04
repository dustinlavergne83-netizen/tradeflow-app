-- Check if twilio_config was saved
SELECT id, company_id, phone_number, forward_to_number, 
       business_hours_start, business_hours_end, ai_enabled, created_at
FROM twilio_config;

-- If empty, the settings didn't save. 
-- If there's a row, check that phone_number matches your Twilio number exactly.
