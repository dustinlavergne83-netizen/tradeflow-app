-- ============================================================
-- FIX: Make shift_id nullable in shift_segments
-- 
-- Problem: Manual punches were failing with:
--   "null value in column 'shift_id' violates not-null constraint"
-- 
-- Root cause: The shift_id column is NOT NULL, but manual punches
--   added via the admin UI don't have a parent shift record.
--
-- Solution: Allow shift_id to be NULL so manual punches can be
--   inserted without requiring a corresponding shift row.
-- ============================================================

ALTER TABLE shift_segments ALTER COLUMN shift_id DROP NOT NULL;
