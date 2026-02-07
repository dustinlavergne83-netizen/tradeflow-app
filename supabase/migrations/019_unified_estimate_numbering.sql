-- Create a unified sequence for both estimates and proposals
CREATE SEQUENCE IF NOT EXISTS unified_estimate_number_seq START WITH 1001;

-- Function to get next estimate number
CREATE OR REPLACE FUNCTION get_next_estimate_number()
RETURNS TEXT AS $$
DECLARE
    next_num INTEGER;
BEGIN
    next_num := nextval('unified_estimate_number_seq');
    RETURN next_num::TEXT;
END;
$$ LANGUAGE plpgsql;

-- Update estimates table to use the unified sequence
-- Add a trigger to auto-generate estimate numbers if not provided
CREATE OR REPLACE FUNCTION set_estimate_number()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.estimate_number IS NULL OR NEW.estimate_number = '' THEN
        NEW.estimate_number := get_next_estimate_number();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_estimate_number_trigger ON estimates;
CREATE TRIGGER set_estimate_number_trigger
BEFORE INSERT ON estimates
FOR EACH ROW
EXECUTE FUNCTION set_estimate_number();

-- Update proposals table to use the unified sequence
-- Add a trigger to auto-generate proposal numbers if not provided
CREATE OR REPLACE FUNCTION set_proposal_number()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.proposal_number IS NULL OR NEW.proposal_number = '' THEN
        NEW.proposal_number := get_next_estimate_number();
    END IF
;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_proposal_number_trigger ON proposals;
CREATE TRIGGER set_proposal_number_trigger
BEFORE INSERT ON proposals
FOR EACH ROW
EXECUTE FUNCTION set_proposal_number();

-- Update the sequence to start from the highest existing number + 1
-- This ensures we don't have duplicate numbers
DO $$
DECLARE
    max_estimate_num INTEGER;
    max_proposal_num INTEGER;
    highest_num INTEGER;
BEGIN
    -- Get highest estimate number (strip non-numeric characters)
    SELECT COALESCE(MAX(CAST(REGEXP_REPLACE(estimate_number, '[^0-9]', '', 'g') AS INTEGER)), 1000)
    INTO max_estimate_num
    FROM estimates
    WHERE estimate_number ~ '^[0-9]+$';
    
    -- Get highest proposal number (strip non-numeric characters)
    SELECT COALESCE(MAX(CAST(REGEXP_REPLACE(proposal_number, '[^0-9]', '', 'g') AS INTEGER)), 1000)
    INTO max_proposal_num
    FROM proposals
    WHERE proposal_number ~ '^[0-9]+$';
    
    -- Get the highest of both
    highest_num := GREATEST(max_estimate_num, max_proposal_num);
    
    -- Set sequence to start from highest + 1
    PERFORM setval('unified_estimate_number_seq', highest_num + 1, false);
END $$;
