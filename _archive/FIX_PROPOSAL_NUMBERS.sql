-- Fix existing proposal numbers to use estimate-based format
-- This will update proposals like PROP-26-0004 to 1004-1, 1004-2, etc.

DO $$
DECLARE
    prop RECORD;
    estimate_num TEXT;
    proposal_sequence INTEGER;
    new_number TEXT;
BEGIN
    -- Loop through all proposals that have a base_estimate_id
    FOR prop IN 
        SELECT p.id, p.proposal_number, p.base_estimate_id, e.estimate_number
        FROM proposals p
        LEFT JOIN estimates e ON e.id = p.base_estimate_id
        WHERE p.base_estimate_id IS NOT NULL
        ORDER BY p.created_at
    LOOP
        -- Get the estimate number (strip EST- prefix if present)
        estimate_num := REGEXP_REPLACE(prop.estimate_number, '^EST-', '');
        
        -- Count how many proposals already exist for this estimate (in correct format)
        SELECT COUNT(*) INTO proposal_sequence
        FROM proposals
        WHERE base_estimate_id = prop.base_estimate_id
        AND proposal_number LIKE estimate_num || '-%'
        AND id < prop.id;  -- Only count earlier proposals
        
        -- Generate new number: estimateNumber-sequence (e.g., 1004-1, 1004-2)
        new_number := estimate_num || '-' || (proposal_sequence + 1);
        
        -- Update the proposal
        UPDATE proposals
        SET proposal_number = new_number
        WHERE id = prop.id;
        
        RAISE NOTICE 'Updated proposal % from % to %', prop.id, prop.proposal_number, new_number;
    END LOOP;
END $$;

-- Verify the changes
SELECT 
    p.proposal_number as "Proposal #",
    p.contractor_name as "Contractor",
    e.estimate_number as "Base Estimate",
    p.created_at::date as "Created"
FROM proposals p
LEFT JOIN estimates e ON e.id = p.base_estimate_id
ORDER BY p.created_at;
