-- Run this SQL directly in Supabase SQL Editor
-- Dashboard -> SQL Editor -> New Query -> Paste and Run

-- ====================================
-- PROPOSALS TABLE
-- ====================================

CREATE TABLE IF NOT EXISTS proposals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id UUID,
  
  -- Estimate References
  base_estimate_id UUID,
  
  -- Recipient Information
  contractor_id UUID,
  contractor_name TEXT,
  contractor_email TEXT,
  
  -- Proposal Details
  proposal_number TEXT,
  proposal_date DATE DEFAULT CURRENT_DATE,
  valid_until DATE,
  
  -- Financial Summary
  base_bid_amount DECIMAL(12,2) DEFAULT 0,
  total_amount DECIMAL(12,2) DEFAULT 0,
  
  -- Status and Tracking
  status TEXT DEFAULT 'draft',
  sent_at TIMESTAMPTZ,
  viewed_at TIMESTAMPTZ,
  responded_at TIMESTAMPTZ,
  
  -- Notes
  notes TEXT,
  internal_notes TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Proposal Alternates (junction table)
CREATE TABLE IF NOT EXISTS proposal_alternates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  proposal_id UUID REFERENCES proposals(id) ON DELETE CASCADE,
  alternate_estimate_id UUID,
  alternate_number INTEGER,
  alternate_title TEXT,
  amount DECIMAL(12,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_proposals_company ON proposals(company_id);
CREATE INDEX IF NOT EXISTS idx_proposals_project ON proposals(project_id);
CREATE INDEX IF NOT EXISTS idx_proposals_status ON proposals(status);
CREATE INDEX IF NOT EXISTS idx_proposal_alternates_proposal ON proposal_alternates(proposal_id);

-- Enable Row Level Security
ALTER TABLE proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE proposal_alternates ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own proposals" ON proposals;
DROP POLICY IF EXISTS "Users can insert their own proposals" ON proposals;
DROP POLICY IF EXISTS "Users can update their own proposals" ON proposals;
DROP POLICY IF EXISTS "Users can delete their own proposals" ON proposals;
DROP POLICY IF EXISTS "Users can view proposal alternates" ON proposal_alternates;
DROP POLICY IF EXISTS "Users can insert proposal alternates" ON proposal_alternates;
DROP POLICY IF EXISTS "Users can update proposal alternates" ON proposal_alternates;
DROP POLICY IF EXISTS "Users can delete proposal alternates" ON proposal_alternates;

-- RLS Policies for proposals
CREATE POLICY "Users can view their own proposals"
  ON proposals FOR SELECT
  USING (auth.uid() = company_id);

CREATE POLICY "Users can insert their own proposals"
  ON proposals FOR INSERT
  WITH CHECK (auth.uid() = company_id);

CREATE POLICY "Users can update their own proposals"
  ON proposals FOR UPDATE
  USING (auth.uid() = company_id);

CREATE POLICY "Users can delete their own proposals"
  ON proposals FOR DELETE
  USING (auth.uid() = company_id);

-- RLS Policies for proposal_alternates
CREATE POLICY "Users can view proposal alternates"
  ON proposal_alternates FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM proposals 
    WHERE proposals.id = proposal_alternates.proposal_id 
    AND proposals.company_id = auth.uid()
  ));

CREATE POLICY "Users can insert proposal alternates"
  ON proposal_alternates FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM proposals 
    WHERE proposals.id = proposal_alternates.proposal_id 
    AND proposals.company_id = auth.uid()
  ));

CREATE POLICY "Users can update proposal alternates"
  ON proposal_alternates FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM proposals 
    WHERE proposals.id = proposal_alternates.proposal_id 
    AND proposals.company_id = auth.uid()
  ));

CREATE POLICY "Users can delete proposal alternates"
  ON proposal_alternates FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM proposals 
    WHERE proposals.id = proposal_alternates.proposal_id 
    AND proposals.company_id = auth.uid()
  ));
