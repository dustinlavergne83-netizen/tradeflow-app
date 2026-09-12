-- ====================================
-- SUPPORT MULTIPLE ACTIVE PROPOSALS PER PROJECT
-- ====================================
-- Previously a project could only have ONE "winning" proposal
-- (projects.winning_proposal_id — a single UUID). Activating a second
-- proposal silently overwrote the first, wiping out its contract value
-- and contractor name.
--
-- This adds an explicit multi-select flag so several proposals (e.g. one
-- per trade/contractor, or one per scope) can all be active on the same
-- project simultaneously, each tracked and billed independently.
--
-- projects.winning_proposal_id is KEPT for backward compatibility — it now
-- represents the "primary" active proposal (e.g. the largest by value),
-- while is_active_contract marks the full set.

ALTER TABLE proposals
  ADD COLUMN IF NOT EXISTS is_active_contract BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS activated_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_proposals_is_active_contract
  ON proposals(is_active_contract) WHERE is_active_contract = TRUE;

COMMENT ON COLUMN proposals.is_active_contract IS
  'TRUE when this proposal has been approved/activated as (one of possibly several) active contracts for its project. Multiple proposals on the same project can be active at once.';
COMMENT ON COLUMN proposals.activated_at IS
  'Timestamp when is_active_contract was last set to TRUE.';
