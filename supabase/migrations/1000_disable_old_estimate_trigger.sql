-- Disable the old estimate_items_update_totals trigger that's causing inconsistent totals
-- This trigger was from the original schema and conflicts with the current estimate system

-- Drop the trigger if it exists
DROP TRIGGER IF EXISTS estimate_items_update_totals ON estimate_items;

-- Optional: Also drop the function if you want to completely remove it
-- (Comment this out if you think you might need to re-enable the trigger later)
DROP FUNCTION IF EXISTS update_estimate_totals();

-- Add a comment for future reference
COMMENT ON TABLE estimates IS 'Estimate totals are now managed by the application code, not by database triggers';
