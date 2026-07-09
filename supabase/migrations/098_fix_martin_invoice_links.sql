-- ============================================================
-- MIGRATION 098: Fix Martin Project Invoice Links
-- ============================================================


-- ============================================================
-- STEP 1a — UNDO: Clear proposal link from CO invoices
-- The previous run accidentally linked the change order invoices.
-- This clears source_proposal_id back to NULL for all CO invoices.
-- ============================================================

UPDATE invoices
SET source_proposal_id = NULL
WHERE invoice_number LIKE '1007-CO%';


-- ============================================================
-- STEP 1b — DATA FIX: Link only the 3 base progress invoices
-- UUID confirmed from diagnostic: c6fb8117-207f-4eb0-a034-1de88bc0efdb
-- ============================================================

UPDATE invoices
SET source_proposal_id = 'c6fb8117-207f-4eb0-a034-1de88bc0efdb'
WHERE invoice_number IN ('1007-1', '1007-2', '1007-3');


-- ============================================================
-- STEP 2 — VERIFY
-- Uncomment and run to confirm all 1007-x invoices are linked
-- ============================================================

SELECT
   i.invoice_number,
   p.proposal_number AS linked_proposal,
   i.source_proposal_id
 FROM invoices i
 LEFT JOIN proposals p ON p.id = i.source_proposal_id
 WHERE i.invoice_number LIKE '1007-%'
 ORDER BY i.invoice_number;


-- ============================================================
-- STEP 3 — ENFORCEMENT RULE
-- Run after Step 1 is confirmed.
-- Progress invoices can only be linked to proposals that
-- belong to a project.
-- ============================================================

CREATE OR REPLACE FUNCTION check_proposal_project_link(
  p_proposal_id UUID,
  p_estimate_id UUID
)
RETURNS BOOLEAN
LANGUAGE sql STABLE
AS $chk$
  SELECT EXISTS (
    SELECT 1 FROM proposals
    WHERE id            = p_proposal_id
      AND project_id   IS NOT NULL
      AND (p_estimate_id IS NULL OR base_estimate_id = p_estimate_id)
  )
$chk$;

ALTER TABLE invoices
  DROP CONSTRAINT IF EXISTS chk_progress_invoice_proposal_link;

ALTER TABLE invoices
  ADD CONSTRAINT chk_progress_invoice_proposal_link
  CHECK (
    source_proposal_id IS NULL
    OR check_proposal_project_link(source_proposal_id, source_estimate_id)
  );
