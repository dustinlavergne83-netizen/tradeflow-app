-- Update proposal numbering to use estimate number + suffix
-- For multiple proposals from the same estimate: 1001-1, 1001-2, 1001-3, etc.

CREATE OR REPLACE FUNCTION set_proposal_number()
RETURNS TRIGGER AS $$
DECLARE
    estimate_num TEXT;
    proposal_count INTEGER;
    new_proposal_number TEXT;
BEGIN
    -- Only generate if proposal_number is not already set
    IF NEW.proposal_number IS NULL OR NEW.proposal_number = '' THEN
        -- Check if this proposal is linked to an estimate
        IF NEW.base_estimate_id IS NOT NULL THEN
            -- Get the estimate number from the estimates table
            SELECT estimate_number INTO estimate_num
            FROM estimates
            WHERE id = NEW.base_estimate_id;
            
            IF estimate_num IS NOT NULL THEN
                -- Count existing proposals for this estimate
                SELECT COUNT(*) INTO proposal_count
                FROM proposals
                WHERE base_estimate_id = NEW.base_estimate_id;
                
                -- Generate number as: estimateNumber-count (e.g., 1001-1, 1001-2)
                new_proposal_number := estimate_num || '-' || (proposal_count + 1)::TEXT;
                NEW.proposal_number := new_proposal_number;
            ELSE
                -- If no estimate number found, use the unified sequence
                NEW.proposal_number := get_next_estimate_number();
            END IF;
        ELSE
            -- If no estimate linked, use the unified sequence
            NEW.proposal_number := get_next_estimate_number();
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate the trigger
DROP TRIGGER IF EXISTS set_proposal_number_trigger ON proposals;
CREATE TRIGGER set_proposal_number_trigger
BEFORE INSERT ON proposals
FOR EACH ROW
EXECUTE FUNCTION set_proposal_number();
