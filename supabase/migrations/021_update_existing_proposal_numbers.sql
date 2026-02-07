-- Update existing proposal numbers to use estimate-based format
-- Changes PROP-25-0003 to 1001-3 format

DO $$
DECLARE
    prop RECORD;
    estimate_num TEXT;
    proposal_count INTEGER;
    new_number TEXT;
BEGIN
    -- Loop through all proposals that have a base_estimate_id
    FOR prop IN 
        SELECT id, base_estimate_id, proposal_number 
        FROM proposals 
        WHERE base_estimate_id IS NOT NULL
        ORDER BY created_at
    LOOP
        -- Get the estimate number
        SELECT estimate_number INTO estimate_num
        FROM estimates
        WHERE id = prop.base_estimate_id;
        
        IF estimate_num IS NOT NULL THEN
            -- Count how many proposals we've already processed for this estimate
            SELECT COUNT(*) INTO proposal_count
            FROM proposals
            WHERE base_estimate_id = prop.base_estimate_id
            AND id < prop.id;
            
            -- Generate new number: estimateNumber-sequenceNumber
            new_number := estimate_num || '-' || (proposal_count + 1)::TEXT;
            
            -- Update the proposal
            UPDATE proposals
            SET proposal_number = new_number
            WHERE id = prop.id;
            
            RAISE NOTICE 'Updated proposal % from % to %', prop.id, prop.proposal_number, new_number;
        END IF;
    END LOOP;
END $$;
