-- Add price_adjustment column to proposals table
-- This allows a per-contractor price override when creating/saving a proposal.

ALTER TABLE proposals
ADD COLUMN IF NOT EXISTS price_adjustment NUMERIC(12,2) DEFAULT NULL;

COMMENT ON COLUMN proposals.price_adjustment IS 
  'Optional dollar adjustment (+/-) applied on top of the calculated total for this contractor-specific proposal. 
   Negative values = discount, positive = addition. NULL means no adjustment.';
