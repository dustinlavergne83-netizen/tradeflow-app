-- THIS WILL FIX YOUR CO-02 SECTIONS IMMEDIATELY
-- Your items are saved as 'general' but need to be 'lighting'

UPDATE estimate_items 
SET section = 'lighting'
WHERE estimate_id = (
    SELECT id FROM estimates WHERE estimate_number = 'CO-02' LIMIT 1
);

-- Run this in Supabase SQL Editor, then refresh your browser
